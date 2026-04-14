import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTemplatesCopy, getSequenceTimeouts } from '@/lib/config'
import { renderTemplate } from '@/lib/templates/render'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import { OutreachChannel } from '@/lib/channels/types'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { auditLog } from '@/lib/audit'
import { Channel, SequenceState } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const RequestSchema = {
  parse(body: unknown): { debtorIds: string[]; templateCode: string; channel?: Channel } {
    const b = body as Record<string, unknown>
    if (!Array.isArray(b.debtorIds) || b.debtorIds.length === 0) {
      throw new Error('debtorIds must be a non-empty array')
    }
    if (typeof b.templateCode !== 'string' || !b.templateCode) {
      throw new Error('templateCode is required')
    }
    if (b.channel && b.channel !== 'EMAIL' && b.channel !== 'WHATSAPP') {
      throw new Error('channel must be EMAIL or WHATSAPP')
    }
    return {
      debtorIds: b.debtorIds as string[],
      templateCode: b.templateCode as string,
      channel: b.channel as Channel | undefined,
    }
  },
}

function resolveChannel(
  preferredChannel: Channel | undefined,
  client: { email: string | null; telefono: string | null }
): OutreachChannel {
  if (preferredChannel === 'WHATSAPP' && client.telefono) {
    return new WhatsAppDemoChannel()
  }
  if (preferredChannel === 'EMAIL' && client.email) {
    return new EmailChannel()
  }
  // Auto-resolve: prefer email, fallback to whatsapp
  if (client.email) return new EmailChannel()
  if (client.telefono) return new WhatsAppDemoChannel()
  throw new Error('Client has no email or phone number')
}

function computeTemplateVars(
  client: { razonSocial: string },
  pendingInvoices: Array<{ monto: Decimal; fechaVencimiento: Date }>
): Record<string, string> {
  const now = new Date()
  const montoTotal = pendingInvoices.reduce(
    (sum, inv) => sum + Number(inv.monto),
    0
  )
  const oldestInvoice = pendingInvoices.reduce(
    (oldest, inv) =>
      inv.fechaVencimiento < oldest.fechaVencimiento ? inv : oldest,
    pendingInvoices[0]
  )
  const diasVencido = Math.max(
    0,
    Math.floor(
      (now.getTime() - oldestInvoice.fechaVencimiento.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )
  // For invoices not yet due, compute days remaining
  const nearestFuture = pendingInvoices
    .filter((inv) => inv.fechaVencimiento > now)
    .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())[0]
  const diasRestantes = nearestFuture
    ? Math.ceil(
        (nearestFuture.fechaVencimiento.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0

  return {
    razonSocial: client.razonSocial,
    montoTotal: montoTotal.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
    }),
    diasVencido: String(diasVencido),
    fechaVencimiento: oldestInvoice.fechaVencimiento.toLocaleDateString('es-AR'),
    diasRestantes: String(diasRestantes),
  }
}

/**
 * Determine the initial SENT_* state based on template code.
 */
function sentStateForTemplate(templateCode: string): SequenceState {
  if (templateCode === 'firm') return 'SENT_FIRM'
  if (templateCode === 'final') return 'SENT_FINAL'
  return 'SENT_SOFT'
}

export async function POST(req: NextRequest) {
  // Try to get session, but don't block on it (demo phase)
  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // ignore auth errors in demo
  }

  let input: ReturnType<typeof RequestSchema.parse>
  try {
    const body = await req.json()
    input = RequestSchema.parse(body)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const templates = await getTemplatesCopy()
  const templateText = templates[input.templateCode]
  if (!templateText) {
    return NextResponse.json(
      { error: `Template "${input.templateCode}" not found` },
      { status: 400 }
    )
  }

  const timeouts = await getSequenceTimeouts()

  // Load clients with pending invoices and active sequences
  const clients = await prisma.client.findMany({
    where: { id: { in: input.debtorIds } },
    include: {
      invoices: { where: { estado: 'PENDING' } },
      outreachSequences: true,
    },
  })

  const results = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] }

  for (const client of clients) {
    try {
      if (client.invoices.length === 0) {
        results.skipped++
        continue
      }

      const templateVars = computeTemplateVars(client, client.invoices)
      const renderedMessage = renderTemplate(templateText, templateVars)

      // Find or create OutreachSequence
      let sequence = client.outreachSequences.find(
        (s) => s.state !== 'CLOSED' && s.state !== 'PAID'
      )

      if (!sequence) {
        // Determine bucket from oldest invoice
        const diasMax = Math.max(
          ...client.invoices.map((inv) =>
            Math.floor(
              (Date.now() - inv.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        )
        let bucket: 'SIN_VENCER' | 'SUAVE' | 'FIRME' | 'AVISO_FINAL' | 'CRITICO' = 'SUAVE'
        if (diasMax <= 0) bucket = 'SIN_VENCER'
        else if (diasMax <= 30) bucket = 'SUAVE'
        else if (diasMax <= 60) bucket = 'FIRME'
        else if (diasMax <= 90) bucket = 'AVISO_FINAL'
        else bucket = 'CRITICO'

        sequence = await prisma.outreachSequence.create({
          data: {
            clientId: client.id,
            state: 'SCHEDULED',
            currentBucket: bucket,
          },
        })
      }

      let channel: OutreachChannel
      try {
        channel = resolveChannel(input.channel, client)
      } catch {
        results.skipped++
        results.errors.push(
          `${client.cod}: no valid channel available`
        )
        continue
      }

      const { externalMessageId, sentAt } = await channel.send({
        client,
        templateCode: input.templateCode,
        templateVars,
        sequenceId: sequence.id,
        renderedMessage,
      })

      // Create OutreachAttempt
      await prisma.outreachAttempt.create({
        data: {
          sequenceId: sequence.id,
          channel: channel.name,
          templateCode: input.templateCode,
          sentAt,
          externalMessageId,
          rawPayload: { renderedMessage, templateVars },
        },
      })

      // Transition to appropriate SENT_* state
      const targetState = sentStateForTemplate(input.templateCode)

      // Calculate next action time based on timeouts
      let timeoutMs: number
      if (targetState === 'SENT_SOFT') timeoutMs = timeouts.softToFirm * 1000
      else if (targetState === 'SENT_FIRM') timeoutMs = timeouts.firmToFinal * 1000
      else timeoutMs = timeouts.finalToEscalated * 1000
      const nextActionAt = new Date(sentAt.getTime() + timeoutMs)

      await transitionSequence(sequence.id, targetState, {
        nextActionAt,
        actorType: 'USER',
        actorId: userId,
      })

      results.sent++
    } catch (err: any) {
      results.failed++
      results.errors.push(`${client.cod}: ${err.message}`)
    }
  }

  // Audit log the campaign launch
  await auditLog({
    actorType: 'USER',
    actorId: userId,
    action: 'campaign.launch',
    payload: {
      templateCode: input.templateCode,
      channel: input.channel ?? 'auto',
      debtorCount: input.debtorIds.length,
      ...results,
    },
  })

  return NextResponse.json(results)
}
