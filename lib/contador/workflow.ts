import { prisma } from '@/lib/db'
import { generateToken } from './token'
import { auditLog } from '@/lib/audit'
import { getContadorEmail } from '@/lib/config'
import {
  sendNotificationEmail,
  buildAccountantHtml,
} from '@/lib/channels/notification-email'

const TOKEN_EXPIRY_DAYS = 7

export async function sendToAccountant(params: {
  sequenceId: string
  incomingMessageId: string
}): Promise<{ token: string; confirmationUrl: string; mailed: boolean }> {
  // 1. Generate token
  const token = generateToken()

  // 2. Create token record in DB
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  const tokenRecord = await prisma.accountantConfirmationToken.create({
    data: {
      token,
      sequenceId: params.sequenceId,
      incomingMessageId: params.incomingMessageId,
      expiresAt,
    },
  })

  // 3. Build confirmation URL
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const confirmationUrl = `${baseUrl}/accountant/confirm/${token}`

  if (baseUrl.includes('localhost')) {
    console.warn(
      '[sendToAccountant] NEXTAUTH_URL no está configurado en producción — el contador recibirá una URL local inservible.'
    )
  }

  // 4. Load sequence + client + invoices for context
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: params.sequenceId },
    include: {
      client: {
        include: {
          invoices: {
            where: { estado: 'PENDING' },
            orderBy: { fechaVencimiento: 'asc' },
          },
        },
      },
    },
  })

  const invoices = sequence.client.invoices
  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.monto), 0)

  // 5. Send actual email to contador (if configured)
  const contadorEmail = await getContadorEmail()
  let mailed = false
  let mailError: string | null = null

  if (!contadorEmail) {
    mailError = 'contador.email no está configurado en Settings'
    console.warn(`[sendToAccountant] ${mailError}`)
  } else {
    try {
      const html = buildAccountantHtml({
        title: 'Confirmación de pago pendiente',
        intro: `El cliente ${sequence.client.razonSocial} adjuntó un comprobante de pago. Por favor confirmá qué corresponde hacer con las facturas pendientes.`,
        clientName: sequence.client.razonSocial,
        clientCod: sequence.client.cod,
        invoices: invoices.map((inv) => ({
          numero: inv.numero,
          fechaVencimiento: inv.fechaVencimiento,
          monto: Number(inv.monto),
        })),
        totalAmount,
        confirmationUrl,
        expiresAt,
      })

      const bodyText =
        `Confirmación de pago pendiente\n\n` +
        `Cliente: ${sequence.client.razonSocial} (${sequence.client.cod})\n` +
        `Monto pendiente total: $${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n` +
        `Facturas pendientes: ${invoices.length}\n\n` +
        `Confirmá la decisión en: ${confirmationUrl}\n\n` +
        `Este enlace expira el ${expiresAt.toLocaleDateString('es-AR')}.`

      await sendNotificationEmail({
        to: contadorEmail,
        subject: `Confirmar pago — ${sequence.client.razonSocial}`,
        bodyText,
        htmlBody: html,
      })
      mailed = true
    } catch (err: any) {
      mailError = err?.message ?? 'error desconocido'
      console.error('[sendToAccountant] error enviando mail al contador:', err)
    }
  }

  // 6. Audit log
  await auditLog({
    actorType: 'SYSTEM',
    action: 'accountant.tokenCreated',
    targetType: 'AccountantConfirmationToken',
    targetId: tokenRecord.id,
    payload: {
      sequenceId: params.sequenceId,
      incomingMessageId: params.incomingMessageId,
      clientCod: sequence.client.cod,
      clientName: sequence.client.razonSocial,
      pendingInvoiceCount: invoices.length,
      confirmationUrl,
      expiresAt: expiresAt.toISOString(),
      mailed,
      mailError,
    },
  })

  return { token, confirmationUrl, mailed }
}
