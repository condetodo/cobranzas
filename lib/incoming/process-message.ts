import { Channel, IncomingCategory } from '@prisma/client'
import { prisma } from '@/lib/db'
import { classifyResponse, Classification } from '@/lib/agents/agent-c-classifier'
import { generateConversationalReply } from '@/lib/agents/agent-e-conversational'
import { sendToAccountant } from '@/lib/contador/workflow'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { EmailChannel } from '@/lib/channels/email-channel'
import { WhatsAppDemoChannel } from '@/lib/channels/whatsapp-demo-channel'
import { OutreachChannel } from '@/lib/channels/types'
import { auditLog } from '@/lib/audit'
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
  return channel === 'WHATSAPP' ? new WhatsAppDemoChannel() : new EmailChannel()
}

export async function processIncomingMessage(
  params: IncomingMessageParams
): Promise<void> {
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
  const classification: Classification = await classifyResponse({
    text: params.text,
    hasMedia: !!(params.mediaUrl || params.mediaType),
    conversationContext,
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

  // 6. Route by category
  switch (classification.categoria) {
    case 'COMPROBANTE_ADJUNTO': {
      await transitionSequence(sequence.id, 'AWAITING_ACCOUNTANT', {
        actorType: 'SYSTEM',
      })
      // Send to accountant for confirmation
      await sendToAccountant({
        sequenceId: sequence.id,
        incomingMessageId: incomingMsg.id,
      })
      break
    }

    case 'DISPUTA': {
      await transitionSequence(sequence.id, 'ESCALATED_TO_HUMAN', {
        escalationReason: `Disputa detectada: ${params.text.slice(0, 200)}`,
        actorType: 'SYSTEM',
      })
      break
    }

    case 'AUTO_REPLY': {
      // Ignore auto-replies, no state transition
      break
    }

    case 'PAGARA':
    case 'NEGOCIANDO':
    case 'OTRO':
    default: {
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

      const reply = await generateConversationalReply({
        debtorName: sequence.client.razonSocial,
        montoAdeudado,
        diasVencido,
        incomingCategory: classification.categoria,
        incomingMessage: params.text,
        conversationHistory: history,
      })

      // Send reply via channel
      const channelInstance = getChannelInstance(params.channel)
      const { externalMessageId, sentAt } = await channelInstance.send({
        client: sequence.client,
        templateCode: 'conversational_reply',
        templateVars: {},
        sequenceId: sequence.id,
        renderedMessage: reply,
      })

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
}
