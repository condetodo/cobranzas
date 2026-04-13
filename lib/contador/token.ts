import crypto from 'crypto'

export function generateToken(): string {
  return crypto.randomBytes(16).toString('hex') // 32 hex chars
}

export function isTokenValid(token: {
  expiresAt: Date
  consumedAt: Date | null
}): boolean {
  if (token.consumedAt) return false
  if (token.expiresAt < new Date()) return false
  return true
}
