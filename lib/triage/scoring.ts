export interface ScoreInput {
  diasVencidoMax: number
  montoTotal: number
  invoiceCount: number
}

/**
 * Deterministic priority score for a debtor. Returns 0-100 (rounded).
 *
 * Weights:
 *   60% — days overdue (capped at 120 days)
 *   30% — amount owed (log-scaled, capped at 10^7)
 *   10% — invoice count (capped at 10)
 */
export function calculateScore(input: ScoreInput): number {
  const { diasVencidoMax, montoTotal, invoiceCount } = input

  if (diasVencidoMax <= 0) return 0

  const daysComponent = Math.min(diasVencidoMax / 120, 1) * 60
  const amountComponent =
    montoTotal > 0 ? Math.min(Math.log10(montoTotal) / 7, 1) * 30 : 0
  const countComponent = Math.min(invoiceCount / 10, 1) * 10

  const raw = daysComponent + amountComponent + countComponent
  return Math.round(Math.min(Math.max(raw, 0), 100))
}
