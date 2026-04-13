import { z } from 'zod'
import { callAgentJSON, getModel } from './shared'

export const ClassificationSchema = z.object({
  categoria: z.enum([
    'PAGARA',
    'COMPROBANTE_ADJUNTO',
    'NEGOCIANDO',
    'DISPUTA',
    'AUTO_REPLY',
    'OTRO',
  ]),
  confianza: z.number().min(0).max(1),
  metadata: z
    .object({
      montoDetectado: z.number().optional(),
      fechaDetectada: z.string().optional(),
    })
    .optional(),
})

export type Classification = z.infer<typeof ClassificationSchema>

export async function classifyResponse(params: {
  text: string
  hasMedia: boolean
  conversationContext: string[]
}): Promise<Classification> {
  const model = getModel()

  const system = `Sos un clasificador de respuestas de deudores para un sistema de cobranzas de una PyME argentina. \
Tu tarea es analizar el mensaje recibido y clasificarlo en una de estas categorías:
- PAGARA: el deudor promete pagar (con o sin fecha)
- COMPROBANTE_ADJUNTO: el deudor adjunta o menciona un comprobante de pago
- NEGOCIANDO: el deudor quiere negociar el monto, plazo o condiciones
- DISPUTA: el deudor niega la deuda o disputa la factura
- AUTO_REPLY: es una respuesta automática (fuera de oficina, delivery failed, etc.)
- OTRO: no encaja en ninguna categoría anterior

Respondé con JSON que tenga: categoria, confianza (0.0 a 1.0), y metadata opcional con montoDetectado y/o fechaDetectada si se mencionan.`

  const contextStr =
    params.conversationContext.length > 0
      ? `\n\nContexto previo de la conversación:\n${params.conversationContext.join('\n')}`
      : ''

  const userMessage = `Mensaje recibido: "${params.text}"
Tiene adjunto/media: ${params.hasMedia ? 'Sí' : 'No'}${contextStr}

Clasificá este mensaje.`

  return callAgentJSON({ model, system, userMessage, maxTokens: 256 }, ClassificationSchema)
}
