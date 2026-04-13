import { Bucket } from '@prisma/client'
import type { AgingThresholds } from '@/lib/config'

/**
 * Assigns a triage bucket based on maximum days overdue and configured thresholds.
 */
export function assignBucket(diasVencidoMax: number, thresholds: AgingThresholds): Bucket {
  if (diasVencidoMax <= 0) return Bucket.SIN_VENCER
  if (diasVencidoMax < thresholds.suave) return Bucket.SUAVE
  if (diasVencidoMax < thresholds.firme) return Bucket.FIRME
  if (diasVencidoMax < thresholds.avisoFinal) return Bucket.AVISO_FINAL
  return Bucket.CRITICO
}
