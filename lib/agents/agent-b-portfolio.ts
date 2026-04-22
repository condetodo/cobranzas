import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

const BucketEnum = z.enum([
  'SIN_VENCER',
  'SUAVE',
  'FIRME',
  'AVISO_FINAL',
  'CRITICO',
])

const TemplateCodeEnum = z.enum(['soft', 'firm', 'final'])

const PortfolioAnalysisSchema = z.object({
  findings: z.array(
    z.object({
      text: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
    })
  ),
  bucketInsights: z.array(
    z.object({
      bucket: BucketEnum,
      insight: z.string(),
    })
  ),
  planDeAccion: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      targetBucket: BucketEnum,
      templateCode: TemplateCodeEnum,
      estimatedRecovery: z.number().optional(),
    })
  ),
})

export type PortfolioAnalysis = z.infer<typeof PortfolioAnalysisSchema>

const BUCKET_LABELS: Record<string, string> = {
  SIN_VENCER: 'Sin vencer',
  SUAVE: 'Suave',
  FIRME: 'Firme',
  AVISO_FINAL: 'Aviso final',
  CRITICO: 'Crítico',
}

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

  const system = `Sos un analista senior de cobranzas para una PyME argentina.
Analizá el portfolio de deudores y generá un análisis estructurado en JSON.
Tu trabajo NO es inventar segmentos nuevos — los buckets ya están definidos por el usuario
(SIN_VENCER, SUAVE, FIRME, AVISO_FINAL, CRITICO) según los umbrales de aging que él mismo configuró.
Tu trabajo ES: (1) detectar patrones globales en findings, (2) dar un insight específico por cada
bucket que tenga deudores, (3) proponer acciones concretas apuntadas a un bucket existente.
Sé específico con montos y porcentajes. Contexto: Argentina, inflación y dificultades económicas habituales.`

  const activeBuckets = Object.entries(summary.bucketCounts)
    .filter(([, count]) => count > 0)
    .map(([b]) => b)

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

INSTRUCCIONES:

1. findings: 3-5 hallazgos globales sobre el portfolio. Severity "critical" para riesgos concretos de pérdida,
   "warning" para patrones preocupantes, "info" para datos relevantes.

2. bucketInsights: un ítem por cada bucket ACTIVO (con al menos 1 deudor). Los activos hoy son: ${activeBuckets.join(', ')}.
   Cada insight es 1-2 oraciones específicas sobre ese bucket (concentración, riesgo, monto, patrón).
   NO inventes buckets nuevos — usá exactamente los valores del enum: SIN_VENCER, SUAVE, FIRME, AVISO_FINAL, CRITICO.

3. planDeAccion: 2-4 acciones priorizadas. Cada acción apunta a UN bucket (targetBucket, enum) y usa un template
   (templateCode: "soft" | "firm" | "final"). Regla sugerida:
   - soft: para SIN_VENCER / SUAVE (recordatorio amable)
   - firm: para FIRME (aviso formal)
   - final: para AVISO_FINAL / CRITICO (aviso final antes de escalar)
   estimatedRecovery es opcional: monto que se estima recuperar si se ejecuta la acción.

Respondé con JSON que tenga esta estructura exacta:
{
  "findings": [{ "text": "...", "severity": "info|warning|critical" }],
  "bucketInsights": [{ "bucket": "SIN_VENCER|SUAVE|FIRME|AVISO_FINAL|CRITICO", "insight": "..." }],
  "planDeAccion": [{ "title": "...", "description": "...", "targetBucket": "SIN_VENCER|...|CRITICO", "templateCode": "soft|firm|final", "estimatedRecovery": N }]
}`

  return callAgentJSON({ model, system, userMessage, maxTokens: 4096 }, PortfolioAnalysisSchema)
}

// Re-export bucket labels for UI usage
export { BUCKET_LABELS }
