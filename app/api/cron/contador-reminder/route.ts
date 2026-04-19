import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getContadorEmail } from '@/lib/config'
import {
  sendNotificationEmail,
  buildAccountantHtml,
} from '@/lib/channels/notification-email'
import { auditLog } from '@/lib/audit'

const REMINDER_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  const threshold = new Date(Date.now() - REMINDER_THRESHOLD_MS)

  // Tokens older than the threshold that haven't been reminded, not consumed, still valid
  const tokens = await prisma.accountantConfirmationToken.findMany({
    where: {
      createdAt: { lte: threshold },
      reminderSentAt: null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      sequence: {
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
      },
    },
  })

  if (tokens.length === 0) {
    return NextResponse.json({ reminded: 0, mailed: 0, failed: 0 })
  }

  const contadorEmail = await getContadorEmail()
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  let reminded = 0
  let mailed = 0
  let failed = 0

  for (const token of tokens) {
    const client = token.sequence.client
    const invoices = client.invoices
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.monto), 0)
    const confirmationUrl = `${baseUrl}/accountant/confirm/${token.token}`

    let mailError: string | null = null

    if (!contadorEmail) {
      mailError = 'contador.email no configurado'
    } else {
      try {
        const html = buildAccountantHtml({
          title: 'Recordatorio: confirmación pendiente',
          intro: `Hace más de 24h te enviamos un pedido de confirmación para ${client.razonSocial}. Sigue sin responderse — te lo volvemos a pasar.`,
          clientName: client.razonSocial,
          clientCod: client.cod,
          invoices: invoices.map((inv) => ({
            numero: inv.numero,
            fechaVencimiento: inv.fechaVencimiento,
            monto: Number(inv.monto),
          })),
          totalAmount,
          confirmationUrl,
          expiresAt: token.expiresAt,
          isReminder: true,
        })

        const bodyText =
          `Recordatorio: confirmación pendiente\n\n` +
          `Hace más de 24h te mandamos este pedido y sigue sin responder.\n` +
          `Cliente: ${client.razonSocial} (${client.cod})\n` +
          `Monto: $${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n\n` +
          `Confirmar: ${confirmationUrl}\n` +
          `Expira el ${token.expiresAt.toLocaleDateString('es-AR')}.`

        await sendNotificationEmail({
          to: contadorEmail,
          subject: `Recordatorio: confirmar pago — ${client.razonSocial}`,
          bodyText,
          htmlBody: html,
        })
        mailed++
      } catch (err: any) {
        mailError = err?.message ?? 'error desconocido'
        failed++
        console.error(`[contador-reminder] error en token ${token.id}:`, err)
      }
    }

    // Mark reminder as sent regardless — if the mail can't be sent, there's no
    // point retrying every tick; the contador can still consume the token via
    // the original URL if it's already been emailed or forwarded.
    await prisma.accountantConfirmationToken.update({
      where: { id: token.id },
      data: { reminderSentAt: new Date() },
    })
    reminded++

    await auditLog({
      actorType: 'SYSTEM',
      action: 'accountant.reminderSent',
      targetType: 'AccountantConfirmationToken',
      targetId: token.id,
      payload: {
        sequenceId: token.sequenceId,
        clientCod: client.cod,
        mailed: !mailError,
        mailError,
      },
    })
  }

  return NextResponse.json({ reminded, mailed, failed })
}
