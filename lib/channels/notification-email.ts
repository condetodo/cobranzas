import { google } from 'googleapis'

/**
 * Send a transactional email NOT addressed to a debtor — e.g. a confirmation
 * request to the contador, a reminder, or any internal notification.
 *
 * Unlike EmailChannel, this does not require a Client row; the caller just
 * provides the destination address, subject and body.
 */
export async function sendNotificationEmail(params: {
  to: string
  subject: string
  bodyText: string
  htmlBody?: string
}): Promise<{ externalMessageId: string }> {
  const senderEmail = process.env.GMAIL_SENDER_EMAIL ?? 'noreply@cobranzas.ai'

  const encodeSubject = (s: string) =>
    `=?UTF-8?B?${Buffer.from(s, 'utf-8').toString('base64')}?=`

  const boundary = `bndry_${Date.now()}`
  const html = params.htmlBody ?? `<pre>${escapeHtml(params.bodyText)}</pre>`

  const lines = [
    `To: ${params.to}`,
    `From: ${senderEmail}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.bodyText, 'utf-8').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf-8').toString('base64'),
    '',
    `--${boundary}--`,
  ]

  const raw = Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })

  const messageId = response.data.id
  if (!messageId) {
    throw new Error('Gmail API returned no message ID')
  }

  return { externalMessageId: messageId }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Pre-baked HTML template for the contador confirmation / reminder emails.
 */
export function buildAccountantHtml(params: {
  title: string
  intro: string
  clientName: string
  clientCod: string
  invoices: Array<{ numero: string; fechaVencimiento: Date; monto: number }>
  totalAmount: number
  confirmationUrl: string
  expiresAt?: Date
  isReminder?: boolean
}): string {
  const accent = params.isReminder ? '#D97706' : '#2563EB'
  const fmtAmount = (n: number) =>
    `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  const fmtDate = (d: Date) => d.toLocaleDateString('es-AR')

  const rows = params.invoices
    .map(
      (inv) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${escapeHtml(inv.numero)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">${fmtDate(inv.fechaVencimiento)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${fmtAmount(inv.monto)}</td>
      </tr>`
    )
    .join('')

  const expiryNote = params.expiresAt
    ? `<p style="margin: 16px 0 0 0; font-size: 12px; color: #9CA3AF;">Este enlace expira el ${fmtDate(params.expiresAt)}.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: ${accent}; padding: 24px 32px;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 600;">${escapeHtml(params.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; line-height: 1.6; color: #374151;">${escapeHtml(params.intro)}</p>
              <div style="background-color: #F9FAFB; border-radius: 6px; padding: 16px; margin: 16px 0;">
                <div style="font-size: 14px; color: #6B7280; margin-bottom: 4px;">Cliente</div>
                <div style="font-size: 16px; color: #111827; font-weight: 600;">${escapeHtml(params.clientName)}</div>
                <div style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">Código: ${escapeHtml(params.clientCod)}</div>
              </div>
              <h3 style="margin: 24px 0 8px 0; color: #374151; font-size: 14px;">Facturas pendientes</h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #F3F4F6;">
                    <th style="padding: 8px 12px; text-align: left; color: #6B7280; font-weight: 500;">Número</th>
                    <th style="padding: 8px 12px; text-align: left; color: #6B7280; font-weight: 500;">Vencimiento</th>
                    <th style="padding: 8px 12px; text-align: right; color: #6B7280; font-weight: 500;">Monto</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                  <tr style="font-weight: 600; background-color: #F9FAFB;">
                    <td colspan="2" style="padding: 10px 12px;">Total</td>
                    <td style="padding: 10px 12px; text-align: right;">${fmtAmount(params.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
              <div style="text-align: center; margin: 32px 0 0 0;">
                <a href="${params.confirmationUrl}" style="display: inline-block; background-color: ${accent}; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">Confirmar decisión</a>
              </div>
              ${expiryNote}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">Mensaje automatizado del sistema de gestión de cobranzas.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
