import { google } from 'googleapis'
import { Channel, Client } from '@prisma/client'
import { OutreachChannel, SendResult } from './types'

/**
 * Encode subject as RFC 2047 UTF-8 base64 to handle special characters
 */
function encodeSubject(subject: string): string {
  const encoded = Buffer.from(subject, 'utf-8').toString('base64')
  return `=?UTF-8?B?${encoded}?=`
}

/**
 * Build a professional HTML email template
 */
function buildHtmlBody(params: {
  razonSocial: string
  bodyText: string
  templateCode: string
}): string {
  const accentColor = params.templateCode === 'final' ? '#DC2626'
    : params.templateCode === 'firm' ? '#D97706'
    : '#2563EB'

  const headerText = params.templateCode === 'final' ? 'AVISO FINAL'
    : params.templateCode === 'firm' ? 'Aviso de Deuda'
    : 'Recordatorio de Pago'

  // Convert plain text line breaks to HTML paragraphs
  const bodyHtml = params.bodyText
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #374151;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F4F6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${accentColor}; padding: 24px 32px;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
                ${headerText}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                Este es un mensaje automatizado del sistema de gestion de cobranzas.
                <br>Si ya realizo el pago, por favor responda a este correo con el comprobante.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildRawEmail(params: {
  to: string
  from: string
  subject: string
  body: string
  templateCode: string
  razonSocial: string
  sequenceId: string
}): string {
  const htmlBody = buildHtmlBody({
    razonSocial: params.razonSocial,
    bodyText: params.body,
    templateCode: params.templateCode,
  })

  const boundary = `boundary_${Date.now()}`

  const lines = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `X-CobranzasAI-Sequence-Id: ${params.sequenceId}`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.body, 'utf-8').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
    '',
    `--${boundary}--`,
  ]
  const raw = lines.join('\r\n')
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export class EmailChannel implements OutreachChannel {
  readonly name: Channel = 'EMAIL'

  private getGmailClient() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    })
    return google.gmail({ version: 'v1', auth: oauth2Client })
  }

  async send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult> {
    if (!params.client.email) {
      throw new Error(
        `Client ${params.client.id} (${params.client.cod}) has no email address`
      )
    }

    const senderEmail = process.env.GMAIL_SENDER_EMAIL ?? 'noreply@cobranzas.ai'
    const subject =
      params.templateVars['subject'] ??
      `Aviso de deuda - ${params.client.razonSocial}`

    const raw = buildRawEmail({
      to: params.client.email,
      from: senderEmail,
      subject,
      body: params.renderedMessage,
      templateCode: params.templateCode,
      razonSocial: params.client.razonSocial,
      sequenceId: params.sequenceId,
    })

    const gmail = this.getGmailClient()
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    const messageId = response.data.id
    if (!messageId) {
      throw new Error('Gmail API returned no message ID')
    }

    return {
      externalMessageId: messageId,
      sentAt: new Date(),
    }
  }
}
