import { TriageSource, Bucket, InvoiceState } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { getAgingThresholds } from '@/lib/config'
import { calculateScore } from './scoring'
import { assignBucket } from './buckets'
import { generateInsight } from '@/lib/agents/agent-a-insight'
import { analyzePortfolio } from '@/lib/agents/agent-b-portfolio'

export interface TriageRunResult {
  triageRunId: string
  totalDebtors: number
  totalAmount: number
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
}

/**
 * Full triage scan — 3 phases:
 *   Phase 1: Deterministic scoring + bucket assignment; persists TriageRun + DebtorTriageSnapshots.
 *   Phase 2: AI enrichment via Agent A — generates a 2-line insight for the top 50 debtors.
 *   Phase 3: Portfolio analysis via Agent B — produces findings, segments, and action plan.
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
    razonSocial: string
    categoria: string | null
    montoTotal: number
    invoiceCount: number
    diasVencidoMax: number
    bucket: Bucket
    score: number
    snapshotId?: string
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
      razonSocial: client.razonSocial,
      categoria: client.categoria ?? null,
      montoTotal,
      invoiceCount,
      diasVencidoMax,
      bucket,
      score,
    })

    onProgress?.({ phase: 1, done: i + 1, total })
  }

  // 4. Persist TriageRun + snapshots in a single transaction
  const { triageRun } = await prisma.$transaction(async (tx) => {
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

    // createMany doesn't return IDs on all DBs — create individually to capture IDs
    const created = await Promise.all(
      snapshots.map((s) =>
        tx.debtorTriageSnapshot.create({
          data: {
            triageRunId: run.id,
            clientId: s.clientId,
            montoTotal: s.montoTotal,
            invoiceCount: s.invoiceCount,
            diasVencidoMax: s.diasVencidoMax,
            bucket: s.bucket,
            score: s.score,
          },
          select: { id: true },
        })
      )
    )

    // Attach snapshot IDs back to our in-memory list
    snapshots.forEach((s, i) => {
      s.snapshotId = created[i].id
    })

    return { triageRun: run }
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

  // ── Phase 2: AI enrichment — Agent A generates a 2-line insight per debtor ──
  const top50 = [...snapshots]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)

  const BATCH_SIZE = 5
  let phase2Done = 0

  for (let i = 0; i < top50.length; i += BATCH_SIZE) {
    const batch = top50.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (s) => {
        const insight = await generateInsight({
          razonSocial: s.razonSocial,
          montoTotal: s.montoTotal,
          diasVencidoMax: s.diasVencidoMax,
          invoiceCount: s.invoiceCount,
          categoria: s.categoria,
          bucket: s.bucket,
        })

        await prisma.debtorTriageSnapshot.update({
          where: { id: s.snapshotId },
          data: { aiInsight: insight },
        })
      })
    )

    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(
          `[Triage Phase 2] Error generating insight for ${batch[idx].razonSocial}:`,
          result.reason
        )
      }
    })

    phase2Done += batch.length
    onProgress?.({ phase: 2, done: phase2Done, total: 50 })
  }

  // ── Phase 3: Portfolio analysis — Agent B analyzes the full portfolio ──
  const top30 = [...snapshots]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)

  try {
    const portfolioAnalysis = await analyzePortfolio({
      totalDebtors: total,
      totalAmount,
      bucketCounts,
      bucketAmounts,
      sampleDebtors: top30.map((s) => ({
        razonSocial: s.razonSocial,
        montoTotal: s.montoTotal,
        diasVencidoMax: s.diasVencidoMax,
        invoiceCount: s.invoiceCount,
        bucket: s.bucket,
        categoria: s.categoria,
      })),
    })

    await prisma.portfolioAnalysis.create({
      data: {
        triageRunId: triageRun.id,
        findings: portfolioAnalysis.findings,
        segmentos: portfolioAnalysis.segmentos,
        planDeAccion: portfolioAnalysis.planDeAccion,
      },
    })
  } catch (err) {
    console.error('[Triage Phase 3] Error running portfolio analysis:', err)
  }

  onProgress?.({ phase: 3, done: 1, total: 1 })

  return {
    triageRunId: triageRun.id,
    totalDebtors: total,
    totalAmount,
    bucketCounts,
    bucketAmounts,
  }
}
