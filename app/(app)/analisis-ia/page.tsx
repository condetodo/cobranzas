import { prisma } from "@/lib/db"
import { ScanSummaryCard } from "@/components/analisis-ia/scan-summary-card"
import { FindingsList } from "@/components/analisis-ia/findings-list"
import { SegmentCards } from "@/components/analisis-ia/segment-cards"
import { ActionPlanList } from "@/components/analisis-ia/action-plan-list"
import { ReanalyzarButton } from "@/components/analisis-ia/reanalizar-button"
import { ExcelDropzone } from "@/components/import/excel-dropzone"

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
            Importa tus datos para generar un analisis inteligente de tu cartera.
          </p>
        </div>
        <ExcelDropzone />
      </div>
    )
  }

  const analysis = latestRun.portfolioAnalysis
  const findings = (analysis?.findings as Array<{ text: string; severity: string }>) ?? []
  const segmentos = (analysis?.segmentos as Array<{
    name: string
    count: number
    totalAmount: number
    ruleDescription: string
    bucket: string
  }>) ?? []
  const planDeAccion = (analysis?.planDeAccion as Array<{
    title: string
    description: string
    targetSegment: string
    templateCode: string
  }>) ?? []

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

      <ScanSummaryCard
        run={latestRun}
        previousRun={previousRun}
      />

      {findings.length > 0 && <FindingsList findings={findings} />}

      {segmentos.length > 0 && <SegmentCards segmentos={segmentos} />}

      {planDeAccion.length > 0 && (
        <ActionPlanList actions={planDeAccion} />
      )}

      <div className="pt-4">
        <h2 className="text-lg font-semibold mb-3">Importar nuevos datos</h2>
        <ExcelDropzone />
      </div>
    </div>
  )
}
