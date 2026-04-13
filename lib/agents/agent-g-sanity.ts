import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

const SanityCheckSchema = z.object({
  warnings: z.array(
    z.object({
      debtorId: z.string().optional(),
      message: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    })
  ),
  approvedCount: z.number(),
  flaggedCount: z.number(),
})

export type SanityCheck = z.infer<typeof SanityCheckSchema>

export async function checkCampaignSanity(params: {
  templateCode: string
  debtors: Array<{
    id: string
    razonSocial: string
    montoTotal: number
    diasVencidoMax: number
    bucket: string
    hasActiveSequence: boolean
    currentSequenceState?: string
  }>
}): Promise<SanityCheck> {
  const model = getModel()

  const system = `Sos un auditor de campañas de cobranzas para una PyME argentina. \
Tu tarea es revisar si una campaña de cobranzas es segura de enviar. \
Detectá problemas potenciales: deudores con secuencias activas que podrían recibir mensajes duplicados, \
montos inusualmente altos o bajos, deudores recién ingresados, inconsistencias con el template, etc. \
Respondé ÚNICAMENTE con JSON válido.`

  const debtorList = params.debtors
    .map(
      (d) =>
        `- ID: ${d.id}, Nombre: ${d.razonSocial}, Monto: $${d.montoTotal.toLocaleString('es-AR')}, Días vencido: ${d.diasVencidoMax}, Bucket: ${d.bucket}, Secuencia activa: ${d.hasActiveSequence ? `Sí (${d.currentSequenceState ?? 'N/A'})` : 'No'}`
    )
    .join('\n')

  const userMessage = `Revisá esta campaña de cobranzas:

Template a usar: ${params.templateCode}
Total de deudores en la campaña: ${params.debtors.length}

Deudores:
${debtorList}

Respondé con JSON con esta estructura:
{
  "warnings": [{ "debtorId": "string opcional", "message": "descripción del problema", "severity": "low|medium|high" }],
  "approvedCount": número de deudores sin problemas,
  "flaggedCount": número de deudores con advertencias
}`

  return callAgentJSON({ model, system, userMessage, maxTokens: 2048 }, SanityCheckSchema)
}
