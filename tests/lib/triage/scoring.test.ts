import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/lib/triage/scoring'

describe('calculateScore', () => {
  it('returns 0 when diasVencidoMax is 0', () => {
    expect(calculateScore({ diasVencidoMax: 0, montoTotal: 100000, invoiceCount: 3 })).toBe(0)
  })

  it('returns 0 when diasVencidoMax is negative', () => {
    expect(calculateScore({ diasVencidoMax: -10, montoTotal: 100000, invoiceCount: 3 })).toBe(0)
  })

  it('returns high score (>70) for critical debtor (90 days, 500000, 5 invoices)', () => {
    // 90 days: min(90/120,1)*60=45, 500k: log10(500k)/7*30≈24, 5 invoices: 5 → total ≈74
    const score = calculateScore({ diasVencidoMax: 90, montoTotal: 500000, invoiceCount: 5 })
    expect(score).toBeGreaterThan(70)
  })

  it('weights days overdue more than amount', () => {
    // High days, low amount vs low days, high amount
    const highDaysLowAmount = calculateScore({ diasVencidoMax: 90, montoTotal: 1000, invoiceCount: 1 })
    const lowDaysHighAmount = calculateScore({ diasVencidoMax: 10, montoTotal: 10_000_000, invoiceCount: 1 })
    expect(highDaysLowAmount).toBeGreaterThan(lowDaysHighAmount)
  })

  it('clamps score to 0-100', () => {
    const score = calculateScore({ diasVencidoMax: 9999, montoTotal: 999_999_999, invoiceCount: 9999 })
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 when montoTotal is 0', () => {
    // Only days and count contribute; with 0 days it should still be 0
    const score = calculateScore({ diasVencidoMax: 0, montoTotal: 0, invoiceCount: 0 })
    expect(score).toBe(0)
  })

  it('returns correct max of 100 when all components are maxed', () => {
    const score = calculateScore({ diasVencidoMax: 120, montoTotal: 10_000_000, invoiceCount: 10 })
    expect(score).toBe(100)
  })
})
