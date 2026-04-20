import { describe, it, expect } from 'vitest'
import { isValidTransition } from '../../../lib/state-machine/states'

describe('isValidTransition', () => {
  it('SCHEDULED → SENT_SOFT is valid', () => {
    expect(isValidTransition('SCHEDULED', 'SENT_SOFT')).toBe(true)
  })

  it('SENT_SOFT → SENT_FIRM is valid', () => {
    expect(isValidTransition('SENT_SOFT', 'SENT_FIRM')).toBe(true)
  })

  it('SENT_SOFT → IN_CONVERSATION is valid', () => {
    expect(isValidTransition('SENT_SOFT', 'IN_CONVERSATION')).toBe(true)
  })

  it('IN_CONVERSATION → AWAITING_ACCOUNTANT is valid', () => {
    expect(isValidTransition('IN_CONVERSATION', 'AWAITING_ACCOUNTANT')).toBe(true)
  })

  it('SENT_SOFT → AWAITING_ACCOUNTANT is valid (comprobante directo)', () => {
    expect(isValidTransition('SENT_SOFT', 'AWAITING_ACCOUNTANT')).toBe(true)
  })

  it('SENT_FIRM → AWAITING_ACCOUNTANT is valid (comprobante directo)', () => {
    expect(isValidTransition('SENT_FIRM', 'AWAITING_ACCOUNTANT')).toBe(true)
  })

  it('SENT_FINAL → AWAITING_ACCOUNTANT is valid (comprobante directo)', () => {
    expect(isValidTransition('SENT_FINAL', 'AWAITING_ACCOUNTANT')).toBe(true)
  })

  it('AWAITING_ACCOUNTANT → PAID is valid', () => {
    expect(isValidTransition('AWAITING_ACCOUNTANT', 'PAID')).toBe(true)
  })

  it('PAID → SENT_SOFT is invalid', () => {
    expect(isValidTransition('PAID', 'SENT_SOFT')).toBe(false)
  })

  it('CLOSED → any state is invalid', () => {
    const allStates = [
      'SCHEDULED',
      'SENT_SOFT',
      'SENT_FIRM',
      'SENT_FINAL',
      'IN_CONVERSATION',
      'AWAITING_ACCOUNTANT',
      'PAID',
      'PARTIAL_PAID_CONTINUING',
      'ESCALATED_TO_HUMAN',
      'AUTOPILOT_OFF',
      'CLOSED',
    ] as const

    for (const state of allStates) {
      expect(isValidTransition('CLOSED', state)).toBe(false)
    }
  })
})
