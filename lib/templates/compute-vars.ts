import { Decimal } from '@prisma/client/runtime/library'

interface InvoiceLike {
  monto: Decimal
  fechaVencimiento: Date
}

interface ClientLike {
  razonSocial: string
  cod?: string
}

/**
 * Builds the variable map used to render outreach templates ({{razonSocial}},
 * {{montoTotal}}, {{diasVencido}}, etc.). Single source of truth so the manual
 * launch (api/campaigns/launch) and the auto-advance runner produce the same
 * substitutions — otherwise FIRM/FINAL mails sent by the cron arrive with raw
 * {{placeholders}} because the runner skipped the math.
 */
export function computeTemplateVars(
  client: ClientLike,
  pendingInvoices: InvoiceLike[]
): Record<string, string> {
  const now = new Date()

  if (pendingInvoices.length === 0) {
    return {
      razonSocial: client.razonSocial,
      ...(client.cod !== undefined && { clientCod: client.cod }),
      montoTotal: '0,00',
      diasVencido: '0',
      fechaVencimiento: '',
      diasRestantes: '0',
    }
  }

  const montoTotal = pendingInvoices.reduce(
    (sum, inv) => sum + Number(inv.monto),
    0
  )
  const oldestInvoice = pendingInvoices.reduce(
    (oldest, inv) =>
      inv.fechaVencimiento < oldest.fechaVencimiento ? inv : oldest,
    pendingInvoices[0]
  )
  const diasVencido = Math.max(
    0,
    Math.floor(
      (now.getTime() - oldestInvoice.fechaVencimiento.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )
  const nearestFuture = pendingInvoices
    .filter((inv) => inv.fechaVencimiento > now)
    .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())[0]
  const diasRestantes = nearestFuture
    ? Math.ceil(
        (nearestFuture.fechaVencimiento.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0

  return {
    razonSocial: client.razonSocial,
    ...(client.cod !== undefined && { clientCod: client.cod }),
    montoTotal: montoTotal.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
    }),
    diasVencido: String(diasVencido),
    fechaVencimiento: oldestInvoice.fechaVencimiento.toLocaleDateString('es-AR'),
    diasRestantes: String(diasRestantes),
  }
}
