import { prisma } from '@/lib/db'
import { EmailChannel } from './email-channel'
import { WhatsAppDemoChannel } from './whatsapp-demo-channel'
import { OutreachChannel } from './types'

/**
 * Picks an outbound channel for a sequence-driven notification (e.g. payment
 * confirmation, rejection reply). Prefers the channel used on the most recent
 * attempt so the conversation stays on a single medium, and falls back to the
 * first available contact method.
 */
export async function resolveChannelForSequence(
  sequenceId: string,
  client: { email: string | null; telefono: string | null }
): Promise<OutreachChannel> {
  const lastAttempt = await prisma.outreachAttempt.findFirst({
    where: { sequenceId },
    orderBy: { sentAt: 'desc' },
    select: { channel: true },
  })

  if (lastAttempt?.channel === 'WHATSAPP' && client.telefono) {
    return new WhatsAppDemoChannel()
  }
  if (lastAttempt?.channel === 'EMAIL' && client.email) {
    return new EmailChannel()
  }

  if (client.email) return new EmailChannel()
  if (client.telefono) return new WhatsAppDemoChannel()

  throw new Error('Client has no email or phone number')
}
