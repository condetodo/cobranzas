/**
 * DEMO-ONLY WhatsApp channel via Evolution Bot adapter.
 * Will throw in production to prevent accidental use.
 */
import { Channel, Client } from '@prisma/client'
import { OutreachChannel, SendResult } from './types'

export class WhatsAppDemoChannel implements OutreachChannel {
  readonly name: Channel = 'WHATSAPP'

  async send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'WhatsAppDemoChannel is DEMO-ONLY and cannot be used in production'
      )
    }

    const endpoint = process.env.WHATSAPP_DEMO_ENDPOINT
    if (!endpoint) {
      throw new Error('WHATSAPP_DEMO_ENDPOINT env var is not set')
    }
    const apiKey = process.env.WHATSAPP_DEMO_API_KEY
    if (!apiKey) {
      throw new Error('WHATSAPP_DEMO_API_KEY env var is not set')
    }

    const to = params.client.telefono
    if (!to) {
      throw new Error(
        `Client ${params.client.id} (${params.client.cod}) has no phone number`
      )
    }

    const body = {
      to,
      message: params.renderedMessage,
      messageType: params.templateCode,
      debtorId: params.client.id,
      outreachSequenceId: params.sequenceId,
    }

    const response = await fetch(`${endpoint}/cobranzas/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `WhatsApp demo endpoint error ${response.status}: ${text}`
      )
    }

    const data = (await response.json()) as { messageId?: string; id?: string }
    const externalMessageId =
      data.messageId ?? data.id ?? `demo-${Date.now()}`

    return {
      externalMessageId,
      sentAt: new Date(),
    }
  }
}
