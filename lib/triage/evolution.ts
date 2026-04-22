import { prisma } from '@/lib/db'
import type { Bucket } from '@prisma/client'

/**
 * Compara el TriageRun actual vs el anterior para detectar cómo se movió la
 * cartera entre buckets. La query es un FULL OUTER JOIN agregado por
 * Postgres — devuelve ~25 filas máximo sin importar cuántos deudores haya,
 * así que escala a decenas de miles de snapshots sin traer todo a memoria.
 */

const SEVERITY_RANK: Record<Bucket, number> = {
  SIN_VENCER: 0,
  SUAVE: 1,
  FIRME: 2,
  AVISO_FINAL: 3,
  CRITICO: 4,
}

export type TransitionRow = {
  fromBucket: Bucket | null // null = no estaba en el run anterior (entrante)
  toBucket: Bucket | null   // null = no está en el actual (salió: pagó/cerrado)
  count: number
}

export type EvolutionSummary = {
  totals: {
    empeoraron: number
    mejoraron: number
    nuevos: number
    salieron: number
  }
  // Top transiciones a mostrar, ordenadas por prioridad
  // (empeoramientos > nuevos > salieron/mejoras)
  topTransitions: TransitionRow[]
}

/**
 * Corre la query agregada. `currentRunId` y `previousRunId` deben venir del
 * page que llama — la comparación contra null ocurre a nivel SQL con OUTER JOIN.
 */
export async function computeEvolution(
  currentRunId: string,
  previousRunId: string
): Promise<EvolutionSummary> {
  const rows = await prisma.$queryRaw<
    { from_bucket: Bucket | null; to_bucket: Bucket | null; count: bigint }[]
  >`
    SELECT
      prev.bucket AS from_bucket,
      curr.bucket AS to_bucket,
      COUNT(*)::bigint AS count
    FROM
      (SELECT "clientId", "bucket" FROM "DebtorTriageSnapshot" WHERE "triageRunId" = ${currentRunId}) curr
    FULL OUTER JOIN
      (SELECT "clientId", "bucket" FROM "DebtorTriageSnapshot" WHERE "triageRunId" = ${previousRunId}) prev
    ON prev."clientId" = curr."clientId"
    GROUP BY prev.bucket, curr.bucket
  `

  const transitions: TransitionRow[] = rows.map((r) => ({
    fromBucket: r.from_bucket,
    toBucket: r.to_bucket,
    count: Number(r.count),
  }))

  let empeoraron = 0
  let mejoraron = 0
  let nuevos = 0
  let salieron = 0

  for (const t of transitions) {
    if (t.fromBucket === null && t.toBucket !== null) {
      nuevos += t.count
    } else if (t.fromBucket !== null && t.toBucket === null) {
      salieron += t.count
    } else if (t.fromBucket !== null && t.toBucket !== null) {
      if (t.fromBucket === t.toBucket) continue // se mantuvo, no es noticia
      const fromRank = SEVERITY_RANK[t.fromBucket]
      const toRank = SEVERITY_RANK[t.toBucket]
      if (toRank > fromRank) empeoraron += t.count
      else mejoraron += t.count
    }
  }

  // Rankear transiciones para la UI. Prioridad:
  //   1. Empeoramientos (los más graves primero, luego por count)
  //   2. Nuevos entrantes (en peor bucket primero)
  //   3. Pagaron (salieron de cualquier bucket)
  //   4. Mejoraron
  // Excluimos las transiciones "mismo bucket".
  function priority(t: TransitionRow): number {
    if (t.fromBucket !== null && t.toBucket !== null) {
      if (t.fromBucket === t.toBucket) return -1 // drop
      const fromRank = SEVERITY_RANK[t.fromBucket]
      const toRank = SEVERITY_RANK[t.toBucket]
      if (toRank > fromRank) return 1000 + toRank * 10 + (toRank - fromRank)
      return 100 + (fromRank - toRank)
    }
    if (t.fromBucket === null && t.toBucket !== null) {
      return 500 + SEVERITY_RANK[t.toBucket] * 10
    }
    if (t.fromBucket !== null && t.toBucket === null) {
      return 200 + SEVERITY_RANK[t.fromBucket]
    }
    return -1
  }

  const topTransitions = transitions
    .filter((t) => priority(t) >= 0)
    .sort((a, b) => {
      const pa = priority(a)
      const pb = priority(b)
      if (pb !== pa) return pb - pa
      return b.count - a.count
    })
    .slice(0, 5)

  return {
    totals: { empeoraron, mejoraron, nuevos, salieron },
    topTransitions,
  }
}
