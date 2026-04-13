import { callAgent, getModel } from './shared'

export async function generateRejectionMessage(params: {
  debtorName: string
  rejectionReason: string
  montoAdeudado: number
}): Promise<string> {
  const model = getModel()

  const system = `Sos un agente de cobranzas para una PyME argentina. \
Tu tarea es redactar un mensaje claro y profesional explicando por qué un comprobante de pago fue rechazado o una solicitud fue denegada. \
Mantené un tono cordial pero firme. Indicá claramente qué debe hacer el deudor a continuación. \
Respondé en español argentino, en máximo 2-3 párrafos cortos.`

  const userMessage = `Generá un mensaje de rechazo para:
Deudor: ${params.debtorName}
Monto adeudado: $${params.montoAdeudado.toLocaleString('es-AR')}
Motivo del rechazo: ${params.rejectionReason}`

  return callAgent({ model, system, userMessage, maxTokens: 384 })
}
