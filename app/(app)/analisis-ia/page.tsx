import Link from "next/link"
import { prisma } from "@/lib/db"
import { ScanSummaryCard } from "@/components/analisis-ia/scan-summary-card"
import { FindingsList } from "@/components/analisis-ia/findings-list"
import { BucketInsightCards } from "@/components/analisis-ia/bucket-insight-cards"
import { ActionPlanList, type Action } from "@/components/analisis-ia/action-plan-list"
import { ReanalyzarButton } from "@/components/analisis-ia/reanalizar-button"
import { EvolutionPanel } from "@/components/analisis-ia/evolution-panel"
import { computeEvolution } from "@/lib/triage/evolution"

export default async function AnalisisIAPage() {
  // Get the latest triage run with analysis
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: "desc" },
    include: { portfolioAnalysis: true },
  })

  // Get the previous run for deltas
  const previousRun = latestRun
    ? await prisma.triageRun.findFirst({
        where: {
          timestamp: { lt: latestRun.timestamp },
        },
        orderBy: { timestamp: "desc" },
      })
    : null

  // If no runs: show empty state
  if (!latestRun) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analisis IA</h1>
          <p className="text-sm text-muted-foreground">
            Todavia no hay datos analizados.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Importa tus datos desde{" "}
            <Link href="/cartera" className="text-blue-600 underline">
              Cartera
            </Link>{" "}
            para generar el primer analisis.
          </p>
          <p className="text-xs text-muted-foreground">
            O si ya tenes datos cargados, podes correr el analisis manualmente:
          </p>
          <div className="pt-2">
            <ReanalyzarButton />
          </div>
        </div>
      </div>
    )
  }

  const VALID_BUCKETS = new Set([
    "SIN_VENCER",
    "SUAVE",
    "FIRME",
    "AVISO_FINAL",
    "CRITICO",
  ])
  const VALID_TEMPLATES = new Set(["soft", "firm", "final"])

  const analysis = latestRun.portfolioAnalysis
  const findings =
    (analysis?.findings as unknown as Array<{ text: string; severity: string }>) ??
    []
  // Filtrar entries que no cumplan el shape nuevo — runs viejos previos al
  // refactor tienen shape distinto y podrían crashear los componentes.
  const bucketInsights = (
    (analysis?.bucketInsights as unknown as Array<{
      bucket: string
      insight: string
    }>) ?? []
  ).filter((i) => i && typeof i.bucket === "string" && VALID_BUCKETS.has(i.bucket))

  const planDeAccion = (
    (analysis?.planDeAccion as unknown as Action[]) ?? []
  ).filter(
    (a) =>
      a &&
      typeof a.targetBucket === "string" &&
      VALID_BUCKETS.has(a.targetBucket) &&
      VALID_TEMPLATES.has(a.templateCode)
  )

  const bucketCounts = (latestRun.bucketCounts ?? {}) as Record<string, number>
  const bucketAmounts = (latestRun.bucketAmounts ?? {}) as Record<string, number>

  // Evolución: solo tiene sentido si hay un run anterior contra el cual comparar
  const evolution = previousRun
    ? await computeEvolution(latestRun.id, previousRun.id)
    : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analisis IA</h1>
          <p className="text-sm text-muted-foreground">
            Resumen inteligente de la cartera de cobranzas.
          </p>
        </div>
        <ReanalyzarButton />
      </div>

      <ScanSummaryCard run={latestRun} previousRun={previousRun} />

      {evolution && <EvolutionPanel evolution={evolution} />}

      {findings.length > 0 && <FindingsList findings={findings} />}

      <BucketInsightCards
        insights={bucketInsights}
        bucketCounts={bucketCounts}
        bucketAmounts={bucketAmounts}
      />

      {planDeAccion.length > 0 && <ActionPlanList actions={planDeAccion} />}
    </div>
  )
}
