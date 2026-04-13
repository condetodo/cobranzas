import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import * as fs from 'fs'
import { getModel } from './shared'

const anthropic = new Anthropic()

const PaymentProofSchema = z.object({
  montoDetectado: z.number().optional(),
  fechaPago: z.string().optional(),
  medioDePago: z.string().optional(),
  destinatario: z.string().optional(),
  esValido: z.boolean(),
  observaciones: z.string().optional(),
})

export type PaymentProof = z.infer<typeof PaymentProofSchema>

export async function analyzePaymentProof(params: {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  mediaType: string
  debtorName: string
  expectedAmount: number
}): Promise<PaymentProof> {
  const model = getModel()

  // Build image source
  let imageSource: Anthropic.ImageBlockParam['source']

  if (params.imageUrl) {
    imageSource = {
      type: 'url',
      url: params.imageUrl,
    }
  } else {
    // Use base64 — either provided directly or loaded from file
    let base64Data: string
    if (params.imageBase64) {
      base64Data = params.imageBase64
    } else if (params.imagePath) {
      const buffer = fs.readFileSync(params.imagePath)
      base64Data = buffer.toString('base64')
    } else {
      throw new Error('Se debe proveer imagePath, imageUrl o imageBase64')
    }

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type ValidMediaType = (typeof validMediaTypes)[number]

    const normalizedMediaType = params.mediaType as ValidMediaType
    if (!validMediaTypes.includes(normalizedMediaType)) {
      throw new Error(`Tipo de media no soportado: ${params.mediaType}`)
    }

    imageSource = {
      type: 'base64',
      media_type: normalizedMediaType,
      data: base64Data,
    }
  }

  const system = `Sos un experto en verificación de comprobantes de pago para una PyME argentina. \
Analizá la imagen y determiná si es un comprobante de pago válido. \
Extraé la información relevante: monto, fecha, medio de pago y destinatario. \
Respondé ÚNICAMENTE con JSON válido, sin explicaciones ni texto adicional.`

  const userMessage = `Verificá este comprobante de pago para el deudor "${params.debtorName}".
Monto esperado: $${params.expectedAmount.toLocaleString('es-AR')}

Respondé con JSON con esta estructura:
{
  "montoDetectado": número o null,
  "fechaPago": "string o null",
  "medioDePago": "string o null (ej: transferencia, efectivo, cheque)",
  "destinatario": "string o null",
  "esValido": true/false,
  "observaciones": "string opcional con observaciones"
}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: imageSource,
          },
          {
            type: 'text',
            text: userMessage,
          },
        ],
      },
    ],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('No text block in vision agent response')
  }

  const raw = block.text
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Vision agent returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  return PaymentProofSchema.parse(parsed)
}
