import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processIncomingMessage } from '@/lib/incoming/process-message'

interface WhatsAppPayload {
  from: string
  text: string
  mediaUrl?: string
  mediaType?: string
  messageId: string
  timestamp: string
}

export async function POST(req: NextRequest) {
  // 1. Verify API key from Authorization header
  const authHeader = req.headers.get('authorization')
  const expectedKey = process.env.WHATSAPP_DEMO_API_KEY
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let payload: WhatsAppPayload
  try {
    payload = (await req.json()) as WhatsAppPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.from || !payload.text) {
    return NextResponse.json(
      { error: 'from and text are required' },
      { status: 400 }
    )
  }

  // 3. Match `from` phone to Client.telefono
  const client = await prisma.client.findFirst({
    where: { telefono: payload.from },
  })

  if (!client) {
    // Store as unmatched incoming
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: payload.from,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
      },
    })
    return NextResponse.json({ status: 'unmatched', reason: 'no_client' })
  }

  // 4. Find active OutreachSequence for that client
  const sequence = await prisma.outreachSequence.findFirst({
    where: {
      clientId: client.id,
      state: {
        notIn: ['CLOSED', 'PAID'],
      },
    },
    orderBy: { startedAt: 'desc' },
  })

  if (!sequence) {
    // Store as unmatched incoming
    await prisma.incomingMessage.create({
      data: {
        channel: 'WHATSAPP',
        fromAddress: payload.from,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
      },
    })
    return NextResponse.json({ status: 'unmatched', reason: 'no_sequence' })
  }

  // 5. Process the incoming message
  try {
    await processIncomingMessage({
      sequenceId: sequence.id,
      channel: 'WHATSAPP',
      fromAddress: payload.from,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
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
