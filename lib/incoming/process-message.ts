import { Channel, IncomingCategory } from '@prisma/client'
import { prisma } from '@/lib/db'
import { classifyResponse, Classification } from '@/lib/agents/agent-c-classifier'
import { generateConversationalReply } from '@/lib/agents/agent-e-conversational'
import { sendToAccountant } from '@/lib/contador/workflow'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { EmailChannel } from '@/lib/channels/email-channel'
import { EvolutionChannel } from '@/lib/channels/whatsapp-demo-channel'
import { OutreachChannel } from '@/lib/channels/types'
import { auditLog } from '@/lib/audit'
import { liveActivity } from '@/lib/live/activity-bus'
import {
  getSequenceTimeouts,
  getDemoFastMode,
  getTimeoutMs,
} from '@/lib/config'

export interface IncomingMessageParams {
  sequenceId: string
  channel: Channel
  fromAddress: string
  text: string
  mediaUrl?: string
  mediaType?: string
}

function getChannelInstance(channel: Channel): OutreachChannel {
  return channel === 'WHATSAPP' ? new EvolutionChannel() : new EmailChannel()
}

export async function processIncomingMessage(
  params: IncomingMessageParams
): Promise<void> {
  // Live-activity tracing (ephemeral, fire-and-forget — never affects logic).
  const traceId = `in_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
  const startedAt = Date.now()
  let stepCount = 0
  // Emit a step_started/step_finished pair around `fn`. Errors from `fn`
  // propagate (so processing behaves exactly as before); the live event just
  // records ok:false before rethrowing.
  async function tracedStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
    stepCount++
    liveActivity.emit({ kind: 'step_started', source: 'incoming', traceId, step })
    try {
      const result = await fn()
      liveActivity.emit({
        kind: 'step_finished',
        source: 'incoming',
        traceId,
        step,
        ok: true,
      })
      return result
    } catch (err) {
      liveActivity.emit({
        kind: 'step_finished',
        source: 'incoming',
        traceId,
        step,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  // 1. Load sequence with client
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: params.sequenceId },
    include: {
      client: {
        include: {
          invoices: { where: { estado: 'PENDING' } },
        },
      },
    },
  })

  liveActivity.emit({
    kind: 'received',
    source: 'incoming',
    traceId,
    channel: params.channel,
    sender: sequence.client.razonSocial,
    preview: params.text.slice(0, 120),
  })

  // Replies arriving on a sequence that's already in a terminal state (PAID,
  // CLOSED) shouldn't trigger the Agent C classifier or any transition — every
  // outbound transition from PAID/CLOSED is invalid and would throw. Record
  // the incoming for audit and bail. Match strategies in poll-gmail (header,
  // In-Reply-To) don't filter by sequence state, so this guard is required.
  if (sequence.state === 'PAID' || sequence.state === 'CLOSED') {
    const skipped = await prisma.incomingMessage.create({
      data: {
        sequenceId: params.sequenceId,
        channel: params.channel,
        fromAddress: params.fromAddress,
        text: params.text,
        mediaUrl: params.mediaUrl,
        mediaType: params.mediaType,
      },
    })
    await auditLog({
      actorType: 'SYSTEM',
      action: 'incoming.skipped.terminal',
      targetType: 'IncomingMessage',
      targetId: skipped.id,
      payload: {
        sequenceId: params.sequenceId,
        sequenceState: sequence.state,
        channel: params.channel,
      },
    })
    liveActivity.emit({ kind: 'routed', source: 'incoming', traceId, route: 'ignored' })
    liveActivity.emit({
      kind: 'finished',
      source: 'incoming',
      traceId,
      route: 'ignored',
      latencyMs: Date.now() - startedAt,
      steps: stepCount,
    })
    return
  }

  // 2. Get conversation context (last 3 messages)
  const recentAttempts = await prisma.outreachAttempt.findMany({
    where: { sequenceId: params.sequenceId },
    orderBy: { sentAt: 'desc' },
    take: 3,
  })
  const recentIncoming = await prisma.incomingMessage.findMany({
    where: { sequenceId: params.sequenceId },
    orderBy: { receivedAt: 'desc' },
    take: 3,
  })

  const conversationContext = [
    ...recentAttempts.map(
      (a) =>
        `[Agente] ${(a.rawPayload as Record<string, unknown>)?.renderedMessage ?? ''}`
    ),
    ...recentIncoming.map((m) => `[Deudor] ${m.text}`),
  ]
    .slice(0, 3)

  // 3. Create IncomingMessage record + mark sequence as freshly active
  const incomingMsg = await prisma.incomingMessage.create({
    data: {
      sequenceId: params.sequenceId,
      channel: params.channel,
      fromAddress: params.fromAddress,
      text: params.text,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
    },
  })

  // Record the incoming timestamp — used by the IN_CONVERSATION timeout runner
  await prisma.outreachSequence.update({
    where: { id: params.sequenceId },
    data: { lastIncomingAt: new Date() },
  })

  // 4. Call Agent C classifier
  const classification: Classification = await tracedStep(
    'Clasificar (Agent C)',
    () =>
      classifyResponse({
        text: params.text,
        hasMedia: !!(params.mediaUrl || params.mediaType),
        conversationContext,
      })
  )

  liveActivity.emit({
    kind: 'classified',
    source: 'incoming',
    traceId,
    category: classification.categoria,
    confidence: classification.confianza,
  })

  // 5. Update IncomingMessage with classification
  await prisma.incomingMessage.update({
    where: { id: incomingMsg.id },
    data: {
      classifiedCategory: classification.categoria as IncomingCategory,
      classifierMetadata: {
        confianza: classification.confianza,
        ...classification.metadata,
      },
    },
  })

  // Track the chosen branch for the final live event.
  let liveRoute = 'conversacional'
  let livePreview: string | undefined

  // 6. Route by category
  switch (classification.categoria) {
    case 'COMPROBANTE_ADJUNTO': {
      liveRoute = 'contador'
      liveActivity.emit({ kind: 'routed', source: 'incoming', traceId, route: liveRoute })
      liveActivity.emit({ kind: 'started', source: 'incoming', traceId, stage: 'Contador' })
      await tracedStep('Transición → AWAITING_ACCOUNTANT', () =>
        transitionSequence(sequence.id, 'AWAITING_ACCOUNTANT', {
          actorType: 'SYSTEM',
        })
      )
      // Send to accountant for confirmation
      await tracedStep('Enviar al contador', () =>
        sendToAccountant({
          sequenceId: sequence.id,
          incomingMessageId: incomingMsg.id,
        })
      )
      break
    }

    case 'DISPUTA': {
      liveRoute = 'escalamiento'
      liveActivity.emit({ kind: 'routed', source: 'incoming', traceId, route: liveRoute })
      liveActivity.emit({ kind: 'started', source: 'incoming', traceId, stage: 'Escalamiento' })
      await tracedStep('Escalar a humano', () =>
        transitionSequence(sequence.id, 'ESCALATED_TO_HUMAN', {
          escalationReason: `Disputa detectada: ${params.text.slice(0, 200)}`,
          actorType: 'SYSTEM',
        })
      )
      break
    }

    case 'AUTO_REPLY': {
      // Ignore auto-replies, no state transition
      liveRoute = 'auto_reply'
      liveActivity.emit({ kind: 'routed', source: 'incoming', traceId, route: liveRoute })
      break
    }

    case 'PAGARA':
    case 'NEGOCIANDO':
    case 'OTRO':
    default: {
      liveRoute = 'conversacional'
      liveActivity.emit({ kind: 'routed', source: 'incoming', traceId, route: liveRoute })
      liveActivity.emit({
        kind: 'started',
        source: 'incoming',
        traceId,
        stage: 'Conversacional (Agent E)',
      })
      // Arm the IN_CONVERSATION timeout: the runner will escalate if no further
      // incoming messages arrive before this deadline.
      const [timeouts, fastMode] = await Promise.all([
        getSequenceTimeouts(),
        getDemoFastMode(),
      ])
      const inConvMs = getTimeoutMs(timeouts.inConversation, fastMode)
      const conversationDeadline = new Date(Date.now() + inConvMs)

      if (sequence.state !== 'IN_CONVERSATION') {
        await transitionSequence(sequence.id, 'IN_CONVERSATION', {
          nextActionAt: conversationDeadline,
          actorType: 'SYSTEM',
        })
      } else {
        // Already in conversation — just refresh the deadline on this new reply
        await prisma.outreachSequence.update({
          where: { id: sequence.id },
          data: { nextActionAt: conversationDeadline },
        })
      }

      // Generate conversational reply
      const montoAdeudado = sequence.client.invoices.reduce(
        (sum, inv) => sum + Number(inv.monto),
        0
      )
      const oldestInvoice = sequence.client.invoices.reduce(
        (oldest, inv) =>
          inv.fechaVencimiento < oldest.fechaVencimiento ? inv : oldest,
        sequence.client.invoices[0]
      )
      const diasVencido = Math.max(
        0,
        Math.floor(
          (Date.now() - oldestInvoice.fechaVencimiento.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )

      // Build conversation history for Agent E
      const history = [
        ...recentAttempts.map((a) => ({
          role: 'agent' as const,
          text: String(
            (a.rawPayload as Record<string, unknown>)?.renderedMessage ?? ''
          ),
        })),
        ...recentIncoming.map((m) => ({
          role: 'debtor' as const,
          text: m.text,
        })),
      ].slice(-6)

      const reply = await tracedStep('Generar respuesta (Agent E)', () =>
        generateConversationalReply({
          debtorName: sequence.client.razonSocial,
          montoAdeudado,
          diasVencido,
          incomingCategory: classification.categoria,
          incomingMessage: params.text,
          conversationHistory: history,
        })
      )
      livePreview = reply

      // Send reply via channel
      const channelInstance = getChannelInstance(params.channel)
      const { externalMessageId, sentAt } = await tracedStep(
        'Enviar respuesta',
        () =>
          channelInstance.send({
            client: sequence.client,
            templateCode: 'conversational_reply',
            templateVars: {},
            sequenceId: sequence.id,
            renderedMessage: reply,
          })
      )

      // Create OutreachAttempt for the reply
      await prisma.outreachAttempt.create({
        data: {
          sequenceId: sequence.id,
          channel: params.channel,
          templateCode: 'conversational_reply',
          sentAt,
          externalMessageId,
          rawPayload: { renderedMessage: reply },
        },
      })

      // Update incoming message with the agent response link
      await prisma.incomingMessage.update({
        where: { id: incomingMsg.id },
        data: { agentResponseId: externalMessageId },
      })

      break
    }
  }

  // 7. Audit log
  await auditLog({
    actorType: 'SYSTEM',
    action: 'incoming.processed',
    targetType: 'IncomingMessage',
    targetId: incomingMsg.id,
    payload: {
      sequenceId: params.sequenceId,
      channel: params.channel,
      category: classification.categoria,
      confianza: classification.confianza,
    },
  })

  liveActivity.emit({
    kind: 'finished',
    source: 'incoming',
    traceId,
    route: liveRoute,
    latencyMs: Date.now() - startedAt,
    steps: stepCount,
    preview: livePreview,
  })
}
