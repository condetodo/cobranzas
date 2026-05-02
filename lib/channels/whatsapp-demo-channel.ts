import { Channel, Client } from '@prisma/client'
import { OutreachChannel, SendResult } from './types'
import { getEvolutionConfig } from '@/lib/config'
import { toEvolutionNumber } from '@/lib/utils/phone'

/**
 * WhatsApp channel via Evolution API v2.
 *
 * Calls `POST {url}/message/sendText/{instance}` with header `apikey: <key>`.
 * Config comes from the DB (`whatsapp.evolution`), set from the Settings UI.
 *
 * Note: file kept under the legacy `whatsapp-demo-channel` filename to avoid
 * churning imports across the codebase. The class is `EvolutionChannel`.
 */
export class EvolutionChannel implements OutreachChannel {
  readonly name: Channel = 'WHATSAPP'

  async send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult> {
    const cfg = await getEvolutionConfig()
    if (!cfg.url || !cfg.instance || !cfg.apiKey) {
      throw new Error(
        'Evolution config incomplete: set whatsapp.evolution { url, instance, apiKey } in Settings'
      )
    }

    const phone = params.client.telefono
    if (!phone) {
      throw new Error(
        `Client ${params.client.id} (${params.client.cod}) has no phone number`
      )
    }

    const number = toEvolutionNumber(phone)
    const endpoint = `${cfg.url.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(cfg.instance)}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.apiKey,
      },
      body: JSON.stringify({
        number,
        text: params.renderedMessage,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `Evolution send error ${response.status}: ${text}`
      )
    }

    const data = (await response.json()) as {
      key?: { id?: string }
      messageId?: string
    }
    const externalMessageId =
      data.key?.id ?? data.messageId ?? `evo-${Date.now()}`

    return {
      externalMessageId,
      sentAt: new Date(),
    }
  }
}

