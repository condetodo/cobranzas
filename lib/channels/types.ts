import { Channel, Client } from '@prisma/client'

export interface SendResult {
  externalMessageId: string
  sentAt: Date
}

export interface OutreachChannel {
  readonly name: Channel

  send(params: {
    client: Client
    templateCode: string
    templateVars: Record<string, string>
    sequenceId: string
    renderedMessage: string
  }): Promise<SendResult>
}
