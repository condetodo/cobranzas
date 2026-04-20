import { SequenceState } from '@prisma/client'

// Semántica: AWAITING_ACCOUNTANT es alcanzable desde cualquier estado activo
// de cobranza. Si el deudor manda un comprobante (Agent C → COMPROBANTE_ADJUNTO)
// saltamos directo a "esperar confirmación del contador" sin pasar por
// IN_CONVERSATION — el comprobante no es conversación, es una acción concreta
// que necesita aprobación humana.
export const VALID_TRANSITIONS: Record<SequenceState, SequenceState[]> = {
  SCHEDULED: ['SENT_SOFT', 'AUTOPILOT_OFF'],
  SENT_SOFT: ['SENT_FIRM', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT', 'AUTOPILOT_OFF', 'ESCALATED_TO_HUMAN'],
  SENT_FIRM: ['SENT_FINAL', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT', 'AUTOPILOT_OFF', 'ESCALATED_TO_HUMAN'],
  SENT_FINAL: ['ESCALATED_TO_HUMAN', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT', 'AUTOPILOT_OFF'],
  IN_CONVERSATION: ['AWAITING_ACCOUNTANT', 'SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'ESCALATED_TO_HUMAN', 'AUTOPILOT_OFF', 'PAID'],
  AWAITING_ACCOUNTANT: ['PAID', 'PARTIAL_PAID_CONTINUING', 'IN_CONVERSATION', 'ESCALATED_TO_HUMAN'],
  PAID: ['CLOSED'],
  PARTIAL_PAID_CONTINUING: ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT', 'AUTOPILOT_OFF'],
  ESCALATED_TO_HUMAN: ['CLOSED', 'SENT_SOFT', 'IN_CONVERSATION', 'AWAITING_ACCOUNTANT'],
  AUTOPILOT_OFF: ['SENT_SOFT', 'SENT_FIRM', 'SENT_FINAL', 'IN_CONVERSATION', 'CLOSED'],
  CLOSED: [],
}

export function isValidTransition(from: SequenceState, to: SequenceState): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}
