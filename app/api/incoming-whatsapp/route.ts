import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processIncomingMessage } from '@/lib/incoming/process-message'
import { getEvolutionConfig } from '@/lib/config'
import { jidToPhone, lastDigits } from '@/lib/utils/phone'

/**
 * Evolution API v2 webhook payload (event = messages.upsert).
 * Only the fields we actually use are typed.
 */
interface EvolutionWebhookPayload {
  event?: string
  instance?: string
  data?: {
    key?: {
      remoteJid?: string
      fromMe?: boolean
      id?: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      imageMessage?: { caption?: string; url?: string; mimetype?: string }
      audioMessage?: { url?: string; mimetype?: string }
      documentMessage?: { url?: string; mimetype?: string; fileName?: string }
    }
    messageType?: string
    messageTimestamp?: number
  }
}

function extractText(msg: EvolutionWebhookPayload['data']): string {
  const m = msg?.message
  if (!m) return ''
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    ''
  )
}

function extractMedia(msg: EvolutionWebhookPayload['data']): {
  mediaUrl?: string
  mediaType?: string
} {
  const m = msg?.message
  if (!m) return {}
  if (m.imageMessage) return { mediaUrl: m.imageMessage.url, mediaType: m.imageMessage.mimetype }
  if (m.audioMessage) return { mediaUrl: m.audioMessage.url, mediaType: m.audioMessage.mimetype }
  if (m.documentMessage)
    return { mediaUrl: m.documentMessage.url, mediaType: m.documentMessage.mimetype }
  return {}
}

export async function POST(req: NextRequest) {
  // 1. Validate shared secret from query string (?key=...).
  // Evolution v2 webhooks don't support custom auth headers.
  const cfg = await getEvolutionConfig()
  const expectedKey = cfg.webhookSecret
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'whatsapp.evolution.webhookSecret not configured' },
      { status: 500 }
    )
  }
  const providedKey = req.nextUrl.searchParams.get('key')
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let payload: EvolutionWebhookPayload
  try {
    payload = (await req.json()) as EvolutionWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. We only care about MESSAGES_UPSERT events
  if (payload.event && payload.event !== 'messages.upsert') {
    return NextResponse.json({ status: 'ignored', reason: 'event_not_handled' })
  }

  // 4. Skip messages sent BY the bot (echoes of our own outbound sends and
  // messages typed manually from the bot's WhatsApp). Otherwise we'd loop.
  if (payload.data?.key?.fromMe) {
    return NextResponse.json({ status: 'ignored', reason: 'from_me' })
  }

  // 5. Pull text + media + sender JID
  const remoteJid = payload.data?.key?.remoteJid
  if (!remoteJid) {
    return NextResponse.json({ error: 'data.key.remoteJid missing' }, { status: 400 })
  }
  const text = extractText(payload.data)
  const { mediaUrl, mediaType } = extractMedia(payload.data)

  if (!text && !mediaUrl) {
    return NextResponse.json({ status: 'ignored', reason: 'empty_message' })
  }

  // 6. Match sender phone against Client.telefono using last-10-digit normalization
  // (Excel may have local numbers like 1158404881; JID is 5491158404881@s.whatsapp.net)
  const senderPhone = jidToPhone(remoteJid)
  const senderTail = lastDigits(senderPhone, 10)

  const candidates = await prisma.client.findMany({
    where: { telefono: { not: null } },
    select: { id: true, telefono: true },
  })
  const matched = candidates.find(
    (c) => c.telefono && lastDigits(c.telefono, 10) === senderTail
  )

  if (!matched) {
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: senderPhone,
        text,
        mediaUrl,
        mediaType,
      },
    })
    return NextResponse.json({ status: 'unmatched', reason: 'no_client' })
  }

  // 7. Find active OutreachSequence for that client
  const sequence = await prisma.outreachSequence.findFirst({
    where: {
      clientId: matched.id,
      state: { notIn: ['CLOSED', 'PAID'] },
    },
    orderBy: { startedAt: 'desc' },
  })

  if (!sequence) {
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: senderPhone,
        text,
        mediaUrl,
        mediaType,
      },
    })
    return NextResponse.json({ status: 'unmatched', reason: 'no_sequence' })
  }

  // 8. Process the incoming message
  try {
    await processIncomingMessage({
      sequenceId: sequence.id,
      channel: 'WHATSAPP',
      fromAddress: senderPhone,
      text,
      mediaUrl,
      mediaType,
    })
    return NextResponse.json({ status: 'processed' })
  } catch (err: any) {
    console.error('incoming-whatsapp processing error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error processing message' },
      { status: 500 }
    )
  }
}
