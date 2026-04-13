import { callAgent, getModel } from './shared'

export async function generateConversationalReply(params: {
  debtorName: string
  montoAdeudado: number
  diasVencido: number
  incomingCategory: string
  incomingMessage: string
  conversationHistory: Array<{ role: 'debtor' | 'agent'; text: string }>
}): Promise<string> {
  const model = getModel()

  const system = `Sos un agente de cobranzas profesional y empático para una PyME argentina. \
Tu objetivo es recuperar la deuda manteniendo la relación comercial. \
Usá un tono cordial pero firme. Sé concreto con fechas y montos. \
Respondé en español argentino, de forma breve y clara (máximo 3 párrafos cortos). \
No uses bullet points. No repitas información obvia del contexto.`

  const historyStr =
    params.conversationHistory.length > 0
      ? params.conversationHistory
          .map((m) => `${m.role === 'debtor' ? 'Deudor' : 'Agente'}: ${m.text}`)
          .join('\n')
      : 'Sin historial previo.'

  const userMessage = `Deudor: ${params.debtorName}
Monto adeudado: $${params.montoAdeudado.toLocaleString('es-AR')}
Días vencido: ${params.diasVencido}
Clasificación del mensaje entrante: ${params.incomingCategory}

Historial de conversación:
${historyStr}

Último mensaje del deudor: "${params.incomingMessage}"

Generá una respuesta apropiada para este mensaje.`

  return callAgent({ model, system, userMessage, maxTokens: 512 })
}
