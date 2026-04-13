import { describe, it, expect } from 'vitest'
import { assignBucket } from '@/lib/triage/buckets'
import type { AgingThresholds } from '@/lib/config'

const thresholds: AgingThresholds = { suave: 15, firme: 30, avisoFinal: 45 }

describe('assignBucket', () => {
  it('returns SIN_VENCER for 0 days', () => {
    expect(assignBucket(0, thresholds)).toBe('SIN_VENCER')
  })

  it('returns SIN_VENCER for -5 days', () => {
    expect(assignBucket(-5, thresholds)).toBe('SIN_VENCER')
  })

  it('returns SUAVE for 1 day', () => {
    expect(assignBucket(1, thresholds)).toBe('SUAVE')
  })

  it('returns SUAVE for 14 days', () => {
    expect(assignBucket(14, thresholds)).toBe('SUAVE')
  })

  it('returns FIRME for 15 days', () => {
    expect(assignBucket(15, thresholds)).toBe('FIRME')
  })

  it('returns FIRME for 29 days', () => {
    expect(assignBucket(29, thresholds)).toBe('FIRME')
  })

  it('returns AVISO_FINAL for 30 days', () => {
    expect(assignBucket(30, thresholds)).toBe('AVISO_FINAL')
  })

  it('returns AVISO_FINAL for 44 days', () => {
    expect(assignBucket(44, thresholds)).toBe('AVISO_FINAL')
  })

  it('returns CRITICO for 45 days', () => {
    expect(assignBucket(45, thresholds)).toBe('CRITICO')
  })

  it('returns CRITICO for 999 days', () => {
    expect(assignBucket(999, thresholds)).toBe('CRITICO')
  })
})
