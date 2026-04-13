import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isTokenValid } from '@/lib/contador/token'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { generateRejectionMessage } from '@/lib/agents/agent-f-rejection'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import { auditLog } from '@/lib/audit'
import { AccountantDecision } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

interface ConfirmBody {
  token: string
  decision: AccountantDecision
  amount?: number
  rejectionReason?: string
}

export async function POST(req: NextRequest) {
  let body: ConfirmBody
  try {
    body = (await req.json()) as ConfirmBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.token || !body.decision) {
    return NextResponse.json(
      { error: 'token and decision are required' },
      { status: 400 }
    )
  }

  if (!['TOTAL', 'PARTIAL', 'REJECTED'].includes(body.decision)) {
    return NextResponse.json(
      { error: 'decision must be TOTAL, PARTIAL, or REJECTED' },
      { status: 400 }
    )
  }

  try {
  // 1. Load and validate token
  const tokenRecord = await prisma.accountantConfirmationToken.findUnique({
    where: { token: body.token },
    include: {
      sequence: {
        include: {
          client: {
            include: {
              invoices: {
                where: { estado: 'PENDING' },
                orderBy: { fechaVencimiento: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  if (!tokenRecord || !isTokenValid(tokenRecord)) {
    return NextResponse.json(
      { error: 'Token invalido o expirado' },
      { status: 400 }
    )
  }

  const sequence = tokenRecord.sequence
  const invoices = sequence.client.invoices
  let appliedInvoiceIds: string[] = []

  // 2. Process decision
  switch (body.decision) {
    case 'TOTAL': {
      // Mark all pending invoices as PAID
      for (const inv of invoices) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            estado: 'PAID',
            paidAt: new Date(),
            paidAmount: inv.monto,
          },
        })
      }
      appliedInvoiceIds = invoices.map((inv) => inv.id)

      await transitionSequence(sequence.id, 'PAID', {
        closedReason: 'PAID',
        actorType: 'CONTADOR',
      })
      break
    }

    case 'PARTIAL': {
      if (!body.amount || body.amount <= 0) {
        return NextResponse.json(
          { error: 'amount is required for PARTIAL decision' },
          { status: 400 }
        )
      }

      // Apply amount FIFO to oldest invoices first
      let remaining = body.amount
      for (const inv of invoices) {
        if (remaining <= 0) break

        const invoiceAmount = Number(inv.monto)
        if (remaining >= invoiceAmount) {
          // Fully pay this invoice
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              estado: 'PAID',
              paidAt: new Date(),
              paidAmount: inv.monto,
            },
          })
          remaining -= invoiceAmount
          appliedInvoiceIds.push(inv.id)
        } else {
          // Partially pay this invoice (mark the partial amount but keep PENDING)
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: new Decimal(remaining),
            },
          })
          appliedInvoiceIds.push(inv.id)
          remaining = 0
        }
      }

      await transitionSequence(sequence.id, 'PARTIAL_PAID_CONTINUING', {
        closedReason: 'PARTIAL_PAID_CONTINUING',
        actorType: 'CONTADOR',
      })
      break
    }

    case 'REJECTED': {
      await transitionSequence(sequence.id, 'IN_CONVERSATION', {
        actorType: 'CONTADOR',
      })

      // Generate rejection message via Agent F and send to debtor
      const montoAdeudado = invoices.reduce(
        (sum, inv) => sum + Number(inv.monto),
        0
      )
      const rejectionMessage = await generateRejectionMessage({
        debtorName: sequence.client.razonSocial,
        rejectionReason: body.rejectionReason ?? 'Comprobante no válido',
        montoAdeudado,
      })

      // Send via the appropriate channel
      const channel = sequence.client.telefono
        ? new WhatsAppDemoChannel()
        : new EmailChannel()
      const { externalMessageId, sentAt } = await channel.send({
        client: sequence.client,
        templateCode: 'rejection',
        templateVars: {},
        sequenceId: sequence.id,
        renderedMessage: rejectionMessage,
      })

      // Record the outreach attempt
      await prisma.outreachAttempt.create({
        data: {
          sequenceId: sequence.id,
          channel: channel.name,
          templateCode: 'rejection',
          sentAt,
          externalMessageId,
          rawPayload: { renderedMessage: rejectionMessage },
        },
      })
      break
    }
  }

  // 3. Mark token as consumed
  await prisma.accountantConfirmationToken.update({
    where: { id: tokenRecord.id },
    data: { consumedAt: new Date() },
  })

  // 4. Create AccountantConfirmation record
  await prisma.accountantConfirmation.create({
    data: {
      tokenId: tokenRecord.id,
      sequenceId: sequence.id,
      decision: body.decision,
      confirmedAmount: body.decision === 'PARTIAL' ? new Decimal(body.amount!) : null,
      rejectionReason: body.decision === 'REJECTED' ? body.rejectionReason : null,
      appliedInvoiceIds,
    },
  })

  // 5. Audit log
  await auditLog({
    actorType: 'CONTADOR',
    action: 'accountant.confirmed',
    targetType: 'AccountantConfirmation',
    targetId: tokenRecord.id,
    payload: {
      decision: body.decision,
      amount: body.amount,
      rejectionReason: body.rejectionReason,
      appliedInvoiceIds,
      clientCod: sequence.client.cod,
    },
  })

  return NextResponse.json({ status: 'ok', decision: body.decision })
  } catch (err: any) {
    console.error('accountant/confirm error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
