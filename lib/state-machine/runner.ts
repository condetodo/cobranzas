import { SequenceState } from '@prisma/client'
import { prisma } from '../db'
import {
  getSequenceTimeouts,
  getTemplatesCopy,
  getDemoFastMode,
  getTimeoutMs,
  getSequenceChannels,
  getMaxSendFailures,
  getBusinessHours,
  type SequenceChannels,
  type StageChannel,
} from '../config'
import { isWithinBusinessHours } from '../business-hours'
import { renderTemplate } from '../templates/render'
import { transitionSequence } from './transitions'
import { EmailChannel } from '../channels/email-channel'
import { WhatsAppDemoChannel } from '../channels/whatsapp-demo-channel'
import { OutreachChannel } from '../channels/types'

// Postgres advisory lock key for the sequence runner
const ADVISORY_LOCK_KEY = 42

const ACTIVE_SEND_STATES: SequenceState[] = ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL']

const NEXT_TEMPLATE: Record<string, 'firm' | 'final'> = {
  SENT_SOFT: 'firm',
  SENT_FIRM: 'final',
}

const NEXT_STATE: Record<string, SequenceState> = {
  SENT_SOFT: 'SENT_FIRM',
  SENT_FIRM: 'SENT_FINAL',
  SENT_FINAL: 'ESCALATED_TO_HUMAN',
}

function channelInstance(name: StageChannel): OutreachChannel {
  return name === 'WHATSAPP' ? new WhatsAppDemoChannel() : new EmailChannel()
}

function channelForStage(
  stage: 'soft' | 'firm' | 'final',
  channels: SequenceChannels
): OutreachChannel {
  return channelInstance(channels[stage])
}

const ONE_HOUR_MS = 60 * 60 * 1000

export async function advanceSequences(): Promise<{
  advanced: number
  errors: number
  escalatedFromConversation: number
  escalatedByFailures: number
  deferredOutOfHours: number
}> {
  // Attempt to acquire Postgres advisory lock — returns false if already held
  const lockResult = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}::bigint)
  `
  const acquired = lockResult[0]?.pg_try_advisory_lock ?? false
  if (!acquired) {
    return {
      advanced: 0,
      errors: 0,
      escalatedFromConversation: 0,
      escalatedByFailures: 0,
      deferredOutOfHours: 0,
    }
  }

  let advanced = 0
  let errors = 0
  let escalatedFromConversation = 0
  let escalatedByFailures = 0
  let deferredOutOfHours = 0

  try {
    const now = new Date()

    const [timeouts, templates, fastMode, channels, maxFailures, businessHours] = await Promise.all([
      getSequenceTimeouts(),
      getTemplatesCopy(),
      getDemoFastMode(),
      getSequenceChannels(),
      getMaxSendFailures(),
      getBusinessHours(),
    ])

    // Demo fastMode bypasses the business-hours gate — otherwise late-night or
    // weekend demos would silently defer everything.
    const gateOpen = fastMode || isWithinBusinessHours(now, businessHours)

    // ── Sub-routine 1: advance ACTIVE_SEND sequences ────────────────────────
    const sequences = await prisma.outreachSequence.findMany({
      where: {
        state: { in: ACTIVE_SEND_STATES },
        nextActionAt: { lte: now },
        client: { autopilotOff: false },
      },
      include: { client: true },
    })

    for (const seq of sequences) {
      // Defer any pending send to the next business-hour boundary check.
      // Escalations (below) are allowed regardless of the window.
      if (!gateOpen) {
        const nextState = NEXT_STATE[seq.state as string]
        if (nextState !== 'ESCALATED_TO_HUMAN') {
          await prisma.outreachSequence.update({
            where: { id: seq.id },
            data: { nextActionAt: new Date(now.getTime() + ONE_HOUR_MS) },
          })
          deferredOutOfHours++
          continue
        }
      }

      try {
        const currentState = seq.state as string
        const nextState = NEXT_STATE[currentState]

        if (nextState === 'ESCALATED_TO_HUMAN') {
          // SENT_FINAL expired → escalate, no message to send
          await transitionSequence(seq.id, 'ESCALATED_TO_HUMAN', {
            escalationReason: 'Auto-escalated after final notice timeout',
            actorType: 'SYSTEM',
          })
          advanced++
          continue
        }

        const templateCode = NEXT_TEMPLATE[currentState]
        if (!templateCode) {
          throw new Error(`No next template defined for state ${currentState}`)
        }

        const templateText = templates[templateCode]
        if (!templateText) {
          throw new Error(
            `Template "${templateCode}" not found in templates.copy config`
          )
        }

        const templateVars: Record<string, string> = {
          razonSocial: seq.client.razonSocial,
          clientCod: seq.client.cod,
        }
        const renderedMessage = renderTemplate(templateText, templateVars)

        const channel = channelForStage(templateCode, channels)

        let sendResult: { externalMessageId: string; sentAt: Date }
        try {
          sendResult = await channel.send({
            client: seq.client,
            templateCode,
            templateVars,
            sequenceId: seq.id,
            renderedMessage,
          })
        } catch (sendErr: any) {
          // Channel failure: bump counter, escalate if over threshold
          const newCount = seq.sendFailureCount + 1
          if (newCount >= maxFailures) {
            await prisma.outreachSequence.update({
              where: { id: seq.id },
              data: { sendFailureCount: newCount },
            })
            await transitionSequence(seq.id, 'ESCALATED_TO_HUMAN', {
              escalationReason: `Fallo de canal (${newCount} intentos): ${sendErr?.message ?? 'desconocido'}`,
              actorType: 'SYSTEM',
            })
            escalatedByFailures++
          } else {
            await prisma.outreachSequence.update({
              where: { id: seq.id },
              data: { sendFailureCount: newCount },
            })
            console.warn(
              `[runner] Send failed for ${seq.id} (${newCount}/${maxFailures}): ${sendErr?.message}`
            )
            errors++
          }
          continue
        }

        const { externalMessageId, sentAt } = sendResult

        await prisma.outreachAttempt.create({
          data: {
            sequenceId: seq.id,
            channel: channel.name,
            templateCode,
            sentAt,
            externalMessageId,
            rawPayload: {
              renderedMessage,
              templateVars,
            },
          },
        })

        // Reset failure counter on success
        await prisma.outreachSequence.update({
          where: { id: seq.id },
          data: { sendFailureCount: 0 },
        })

        // Calculate next action deadline
        const timeoutValue =
          nextState === 'SENT_FIRM'
            ? timeouts.firmToFinal
            : timeouts.finalToEscalated
        const nextActionAt = new Date(sentAt.getTime() + getTimeoutMs(timeoutValue, fastMode))

        await transitionSequence(seq.id, nextState as SequenceState, {
          nextActionAt,
          actorType: 'SYSTEM',
        })

        advanced++
      } catch (err) {
        console.error(`[runner] Error advancing sequence ${seq.id}:`, err)
        errors++
      }
    }

    // ── Sub-routine 2: escalate stale IN_CONVERSATION sequences ─────────────
    const staleConversations = await prisma.outreachSequence.findMany({
      where: {
        state: 'IN_CONVERSATION',
        nextActionAt: { lte: now },
        client: { autopilotOff: false },
      },
      select: { id: true },
    })

    for (const seq of staleConversations) {
      try {
        await transitionSequence(seq.id, 'ESCALATED_TO_HUMAN', {
          escalationReason: 'Auto-escalated: sin respuesta del deudor durante el timeout de conversación',
          actorType: 'SYSTEM',
        })
        escalatedFromConversation++
      } catch (err) {
        console.error(`[runner] Error escalating stale conversation ${seq.id}:`, err)
        errors++
      }
    }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}::bigint)`
  }

  return {
    advanced,
    errors,
    escalatedFromConversation,
    escalatedByFailures,
    deferredOutOfHours,
  }
}
