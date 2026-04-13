import { google } from 'googleapis'
import { Channel, Client } from '@prisma/client'
import { OutreachChannel, SendResult } from './types'

function buildRawEmail(params: {
  to: string
  subject: string
  body: string
  sequenceId: string
}): string {
  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    `X-CobranzasAI-Sequence-Id: ${params.sequenceId}`,
    '',
    params.body,
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

    const subject =
      params.templateVars['subject'] ??
      `Aviso de deuda — ${params.client.razonSocial}`

    const raw = buildRawEmail({
      to: params.client.email,
      subject,
      body: params.renderedMessage,
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
