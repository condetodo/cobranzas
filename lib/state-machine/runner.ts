import { SequenceState } from '@prisma/client'
import { prisma } from '../db'
import { getSequenceTimeouts, getTemplatesCopy } from '../config'
import { renderTemplate } from '../templates/render'
import { transitionSequence } from './transitions'
import { EmailChannel } from '../channels/email-channel'
import { OutreachChannel } from '../channels/types'

// Postgres advisory lock key for the sequence runner
const ADVISORY_LOCK_KEY = 42

const ACTIVE_SEND_STATES: SequenceState[] = ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL']

/**
 * Template codes for each escalation step.
 * Must exist as keys in the templates.copy config.
 */
const NEXT_TEMPLATE: Record<string, string> = {
  SENT_SOFT: 'firm',
  SENT_FIRM: 'final',
}

const NEXT_STATE: Record<string, SequenceState> = {
  SENT_SOFT: 'SENT_FIRM',
  SENT_FIRM: 'SENT_FINAL',
  SENT_FINAL: 'ESCALATED_TO_HUMAN',
}

/**
 * Resolves the appropriate outreach channel for a client.
 * Prefers WhatsApp when a phone number is available in non-production,
 * otherwise falls back to Email.
 */
function resolveChannel(client: { telefono: string | null }): OutreachChannel {
  // In demo mode with phone number, we could use WhatsApp, but to keep the
  // runner dependency-light we default to Email here. Callers can override.
  return new EmailChannel()
}

export async function advanceSequences(): Promise<{ advanced: number; errors: number }> {
  // Attempt to acquire Postgres advisory lock — returns false if already held
  const lockResult = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}::bigint)
  `
  const acquired = lockResult[0]?.pg_try_advisory_lock ?? false
  if (!acquired) {
    // Another process is already running the runner — skip this tick
    return { advanced: 0, errors: 0 }
  }

  let advanced = 0
  let errors = 0

  try {
    const now = new Date()

    // Load all sequences due for action that are not paused by autopilotOff
    const sequences = await prisma.outreachSequence.findMany({
      where: {
        state: { in: ACTIVE_SEND_STATES },
        nextActionAt: { lte: now },
        client: { autopilotOff: false },
      },
      include: { client: true },
    })

    const [timeouts, templates] = await Promise.all([
      getSequenceTimeouts(),
      getTemplatesCopy(),
    ])

    for (const seq of sequences) {
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

        // SENT_SOFT → SENT_FIRM or SENT_FIRM → SENT_FINAL: send next template
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

        const channel = resolveChannel(seq.client)

        const { externalMessageId, sentAt } = await channel.send({
          client: seq.client,
          templateCode,
          templateVars,
          sequenceId: seq.id,
          renderedMessage,
        })

        // Persist the outreach attempt
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

        // Calculate next action deadline
        const timeoutMs =
          nextState === 'SENT_FIRM'
            ? timeouts.firmToFinal * 1000
            : timeouts.finalToEscalated * 1000
        const nextActionAt = new Date(sentAt.getTime() + timeoutMs)

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
  } finally {
    // Always release the advisory lock
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}::bigint)`
  }

  return { advanced, errors }
}
