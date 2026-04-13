import { SequenceState, ClosedReason, ActorType } from '@prisma/client'
import { prisma } from '../db'
import { auditLog } from '../audit'
import { isValidTransition } from './states'

export async function transitionSequence(
  sequenceId: string,
  newState: SequenceState,
  opts?: {
    nextActionAt?: Date
    pausedReason?: string
    escalationReason?: string
    closedReason?: 'PAID' | 'PARTIAL_PAID_CONTINUING' | 'ESCALATED' | 'MANUAL_OVERRIDE'
    actorType?: ActorType
    actorId?: string
  }
): Promise<void> {
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: sequenceId },
  })

  if (!isValidTransition(sequence.state, newState)) {
    throw new Error(
      `Invalid transition: ${sequence.state} → ${newState} for sequence ${sequenceId}`
    )
  }

  const isTerminal = newState === 'CLOSED' || newState === 'PAID'

  await prisma.outreachSequence.update({
    where: { id: sequenceId },
    data: {
      state: newState,
      ...(opts?.nextActionAt !== undefined && { nextActionAt: opts.nextActionAt }),
      ...(opts?.pausedReason !== undefined && { pausedReason: opts.pausedReason }),
      ...(opts?.escalationReason !== undefined && { escalationReason: opts.escalationReason }),
      ...(opts?.closedReason !== undefined && { closedReason: opts.closedReason as ClosedReason }),
      ...(isTerminal && { closedAt: new Date() }),
    },
  })

  await auditLog({
    actorType: opts?.actorType ?? 'SYSTEM',
    actorId: opts?.actorId,
    action: 'sequence.transition',
    targetType: 'OutreachSequence',
    targetId: sequenceId,
    payload: {
      from: sequence.state,
      to: newState,
      ...(opts?.pausedReason && { pausedReason: opts.pausedReason }),
      ...(opts?.escalationReason && { escalationReason: opts.escalationReason }),
      ...(opts?.closedReason && { closedReason: opts.closedReason }),
    },
  })
}
