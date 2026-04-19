import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isTokenValid } from '@/lib/contador/token'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { generateRejectionMessage } from '@/lib/agents/agent-f-rejection'
import { resolveChannelForSequence } from '@/lib/channels/resolve'
import { renderTemplate } from '@/lib/templates/render'
import {
  getTemplatesCopy,
  getSequenceTimeouts,
  getDemoFastMode,
  getTimeoutMs,
} from '@/lib/config'
import { auditLog } from '@/lib/audit'
import { AccountantDecision } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

interface ConfirmBody {
  token: string
  decision: AccountantDecision
  amount?: number
  rejectionReason?: string
}

function formatCurrency(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
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
    const montoTotalPending = invoices.reduce(
      (sum, inv) => sum + Number(inv.monto) - Number(inv.paidAmount ?? 0),
      0
    )
    let appliedInvoiceIds: string[] = []

    const templates = await getTemplatesCopy()

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

        // Notify debtor: payment received
        await notifyDebtor({
          sequenceId: sequence.id,
          client: sequence.client,
          templateCode: 'paid',
          templateText: templates['paid'] ?? '',
          templateVars: {
            razonSocial: sequence.client.razonSocial,
            montoTotal: formatCurrency(montoTotalPending),
          },
        })

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
        if (body.amount > montoTotalPending + 0.01) {
          return NextResponse.json(
            {
              error: `amount (${body.amount}) excede el monto pendiente (${montoTotalPending.toFixed(2)})`,
            },
            { status: 400 }
          )
        }

        // Apply amount FIFO to oldest invoices first, accumulating into paidAmount
        let remaining = body.amount
        for (const inv of invoices) {
          if (remaining <= 0) break

          const alreadyPaid = Number(inv.paidAmount ?? 0)
          const outstanding = Number(inv.monto) - alreadyPaid
          if (outstanding <= 0) continue

          if (remaining >= outstanding) {
            // Fully pay this invoice
            await prisma.invoice.update({
              where: { id: inv.id },
              data: {
                estado: 'PAID',
                paidAt: new Date(),
                paidAmount: inv.monto,
              },
            })
            remaining -= outstanding
            appliedInvoiceIds.push(inv.id)
          } else {
            // Partial: accumulate into paidAmount (do NOT overwrite prior partials)
            await prisma.invoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: new Decimal(alreadyPaid + remaining),
              },
            })
            appliedInvoiceIds.push(inv.id)
            remaining = 0
          }
        }

        const montoRestante = montoTotalPending - body.amount

        // Notify debtor: partial payment received
        await notifyDebtor({
          sequenceId: sequence.id,
          client: sequence.client,
          templateCode: 'postPartial',
          templateText: templates['postPartial'] ?? '',
          templateVars: {
            razonSocial: sequence.client.razonSocial,
            montoPagado: formatCurrency(body.amount),
            montoRestante: formatCurrency(Math.max(0, montoRestante)),
          },
        })

        // Mark the partial event
        await transitionSequence(sequence.id, 'PARTIAL_PAID_CONTINUING', {
          actorType: 'CONTADOR',
        })

        // Reactivate the sequence on the remaining balance: back to SENT_SOFT
        // with a fresh softToFirm timeout so the cron runner keeps cobranza alive.
        const [timeouts, fastMode] = await Promise.all([
          getSequenceTimeouts(),
          getDemoFastMode(),
        ])
        const nextActionAt = new Date(
          Date.now() + getTimeoutMs(timeouts.softToFirm, fastMode)
        )
        await transitionSequence(sequence.id, 'SENT_SOFT', {
          nextActionAt,
          actorType: 'SYSTEM',
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

        const channel = await resolveChannelForSequence(
          sequence.id,
          sequence.client
        )
        const { externalMessageId, sentAt } = await channel.send({
          client: sequence.client,
          templateCode: 'rejection',
          templateVars: {},
          sequenceId: sequence.id,
          renderedMessage: rejectionMessage,
        })

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
        confirmedAmount:
          body.decision === 'PARTIAL' ? new Decimal(body.amount!) : null,
        rejectionReason:
          body.decision === 'REJECTED' ? body.rejectionReason : null,
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

/**
 * Render and send a debtor-facing notification via the channel most recently
 * used for this sequence. Best-effort — a delivery failure is logged but does
 * not roll back the contador's confirmation.
 */
async function notifyDebtor(params: {
  sequenceId: string
  client: { id: string; email: string | null; telefono: string | null; razonSocial: string; cod: string } & Record<string, any>
  templateCode: string
  templateText: string
  templateVars: Record<string, string>
}): Promise<void> {
  if (!params.templateText) {
    console.warn(
      `[notifyDebtor] template "${params.templateCode}" no configurado — skip`
    )
    return
  }

  try {
    const renderedMessage = renderTemplate(params.templateText, params.templateVars)
    const channel = await resolveChannelForSequence(
      params.sequenceId,
      params.client
    )
    const { externalMessageId, sentAt } = await channel.send({
      client: params.client as any,
      templateCode: params.templateCode,
      templateVars: params.templateVars,
      sequenceId: params.sequenceId,
      renderedMessage,
    })
    await prisma.outreachAttempt.create({
      data: {
        sequenceId: params.sequenceId,
        channel: channel.name,
        templateCode: params.templateCode,
        sentAt,
        externalMessageId,
        rawPayload: { renderedMessage, templateVars: params.templateVars },
      },
    })
  } catch (err) {
    console.error(
      `[notifyDebtor] error sending ${params.templateCode} to ${params.client.cod}:`,
      err
    )
  }
}
