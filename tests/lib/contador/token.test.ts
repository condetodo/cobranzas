import { describe, it, expect } from 'vitest'
import { generateToken, isTokenValid } from '../../../lib/contador/token'

describe('generateToken', () => {
  it('returns a 32-char hex string', () => {
    const token = generateToken()
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('generates unique tokens (100 should all be different)', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })
})

describe('isTokenValid', () => {
  it('returns false for expired token', () => {
    const token = {
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    }
    expect(isTokenValid(token)).toBe(false)
  })

  it('returns false for consumed token', () => {
    const token = {
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: new Date(),
    }
    expect(isTokenValid(token)).toBe(false)
  })

  it('returns true for valid token (not expired, not consumed)', () => {
    const token = {
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
    }
    expect(isTokenValid(token)).toBe(true)
  })
})
