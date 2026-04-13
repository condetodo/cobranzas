import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

const PortfolioAnalysisSchema = z.object({
  findings: z.array(
    z.object({
      text: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
    })
  ),
  segmentos: z.array(
    z.object({
      name: z.string(),
      rule: z.string(),
      count: z.number(),
      totalAmount: z.number(),
    })
  ),
  planDeAccion: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      targetSegment: z.string(),
      recommendedAction: z.string(),
      estimatedRecovery: z.number().optional(),
    })
  ),
})

export type PortfolioAnalysis = z.infer<typeof PortfolioAnalysisSchema>

export async function analyzePortfolio(summary: {
  totalDebtors: number
  totalAmount: number
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
  sampleDebtors: Array<{
    razonSocial: string
    montoTotal: number
    diasVencidoMax: number
    invoiceCount: number
    bucket: string
    categoria?: string | null
  }>
}): Promise<PortfolioAnalysis> {
  const model = getModel('CLAUDE_MODEL_AGENT_PORTFOLIO')

  const system = `Sos un analista senior de cobranzas para una PyME argentina. \
Analizá el portfolio de deudores y generá un análisis estructurado en JSON. \
Identificá patrones de riesgo, segmentá los deudores y proponé un plan de acción concreto y priorizado. \
Sé específico con montos y porcentajes. El contexto es Argentina, con inflación y dificultades económicas habituales.`

  const userMessage = `Analizá el siguiente portfolio de deudores:

RESUMEN GENERAL:
- Total deudores: ${summary.totalDebtors}
- Monto total adeudado: $${summary.totalAmount.toLocaleString('es-AR')}
- Distribución por bucket: ${JSON.stringify(summary.bucketCounts)}
- Montos por bucket: ${JSON.stringify(summary.bucketAmounts)}

MUESTRA DE DEUDORES (top ${summary.sampleDebtors.length}):
${summary.sampleDebtors
  .map(
    (d) =>
      `- ${d.razonSocial}: $${d.montoTotal.toLocaleString('es-AR')}, ${d.diasVencidoMax} días vencido, ${d.invoiceCount} facturas, bucket: ${d.bucket}, categoría: ${d.categoria ?? 'N/A'}`
  )
  .join('\n')}

Respondé con JSON que tenga esta estructura exacta:
{
  "findings": [{ "text": "...", "severity": "info|warning|critical" }],
  "segmentos": [{ "name": "...", "rule": "...", "count": N, "totalAmount": N }],
  "planDeAccion": [{ "title": "...", "description": "...", "targetSegment": "...", "recommendedAction": "...", "estimatedRecovery": N }]
}`

  return callAgentJSON({ model, system, userMessage, maxTokens: 4096 }, PortfolioAnalysisSchema)
}
