import { callAgent, getModel } from './shared'

export async function generateInsight(debtor: {
  razonSocial: string
  montoTotal: number
  diasVencidoMax: number
  invoiceCount: number
  categoria?: string | null
  bucket: string
}): Promise<string> {
  const model = getModel()

  const system = `Sos un analista de cobranzas experto para una PyME argentina. \
Generá un insight de exactamente 2 líneas sobre el deudor, destacando el riesgo y una recomendación accionable. \
Sé directo y concreto. No uses bullet points ni numeración. Solo 2 líneas separadas por un salto de línea.`

  const userMessage = `Deudor: ${debtor.razonSocial}
Monto total adeudado: $${debtor.montoTotal.toLocaleString('es-AR')}
Días vencidos (máximo): ${debtor.diasVencidoMax}
Cantidad de facturas: ${debtor.invoiceCount}
Categoría: ${debtor.categoria ?? 'Sin categoría'}
Bucket de riesgo: ${debtor.bucket}`

  return callAgent({ model, system, userMessage, maxTokens: 150 })
}
