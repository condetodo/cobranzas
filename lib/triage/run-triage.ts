import { TriageSource, Bucket, InvoiceState } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { getAgingThresholds } from '@/lib/config'
import { calculateScore } from './scoring'
import { assignBucket } from './buckets'

export interface TriageRunResult {
  triageRunId: string
  totalDebtors: number
  totalAmount: number
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
}

/**
 * Phase 1: Deterministic triage scan.
 * Queries all clients with PENDING invoices, computes scores + buckets, and
 * persists a TriageRun + DebtorTriageSnapshots in a single transaction.
 *
 * Phases 2-3 (AI enrichment) will be added in Task 7.
 */
export async function runTriage(
  source: TriageSource,
  excelFileName?: string,
  onProgress?: (progress: { phase: number; done: number; total: number }) => void
): Promise<TriageRunResult> {
  // 1. Get aging thresholds from config
  const thresholds = await getAgingThresholds()

  // 2. Query all clients that have at least one PENDING invoice
  const clients = await prisma.client.findMany({
    where: {
      invoices: {
        some: { estado: InvoiceState.PENDING },
      },
    },
    include: {
      invoices: {
        where: { estado: InvoiceState.PENDING },
      },
    },
  })

  const total = clients.length
  const now = new Date()

  // Accumulators
  const bucketCounts: Record<string, number> = {}
  const bucketAmounts: Record<string, number> = {}

  // Zero-initialise all bucket keys so they always appear in the result
  for (const b of Object.values(Bucket)) {
    bucketCounts[b] = 0
    bucketAmounts[b] = 0
  }

  type SnapshotData = {
    clientId: string
    montoTotal: number
    invoiceCount: number
    diasVencidoMax: number
    bucket: Bucket
    score: number
  }

  const snapshots: SnapshotData[] = []
  let totalAmount = 0

  // 3. Compute per-client metrics
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const pendingInvoices = client.invoices

    const montoTotal = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.monto),
      0
    )

    const diasVencidoMax = pendingInvoices.reduce((max, inv) => {
      const days = Math.floor(
        (now.getTime() - new Date(inv.fechaVencimiento).getTime()) /
          (1000 * 60 * 60 * 24)
      )
      return Math.max(max, days)
    }, 0)

    const invoiceCount = pendingInvoices.length

    const bucket = assignBucket(diasVencidoMax, thresholds)
    const score = calculateScore({ diasVencidoMax, montoTotal, invoiceCount })

    bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1
    bucketAmounts[bucket] = (bucketAmounts[bucket] ?? 0) + montoTotal
    totalAmount += montoTotal

    snapshots.push({
      clientId: client.id,
      montoTotal,
      invoiceCount,
      diasVencidoMax,
      bucket,
      score,
    })

    onProgress?.({ phase: 1, done: i + 1, total })
  }

  // 4. Persist TriageRun + snapshots in a single transaction
  const triageRun = await prisma.$transaction(async (tx) => {
    const run = await tx.triageRun.create({
      data: {
        source,
        excelFileName,
        totalDebtors: total,
        totalAmount,
        bucketCounts,
        bucketAmounts,
      },
    })

    await tx.debtorTriageSnapshot.createMany({
      data: snapshots.map((s) => ({
        triageRunId: run.id,
        clientId: s.clientId,
        montoTotal: s.montoTotal,
        invoiceCount: s.invoiceCount,
        diasVencidoMax: s.diasVencidoMax,
        bucket: s.bucket,
        score: s.score,
      })),
    })

    return run
  })

  // 5. Audit log
  await auditLog({
    actorType: 'SYSTEM',
    action: 'TRIAGE_RUN',
    targetType: 'TriageRun',
    targetId: triageRun.id,
    payload: {
      source,
      excelFileName,
      totalDebtors: total,
      totalAmount,
      bucketCounts,
    },
  })

  return {
    triageRunId: triageRun.id,
    totalDebtors: total,
    totalAmount,
    bucketCounts,
    bucketAmounts,
  }
}
