import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { LiveRecentResponse } from '@/lib/live/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RECENT_LIMIT = 8

/**
 * GET /api/live/recent — last few incoming messages, to seed the dashboard feed
 * the moment a client connects (before any live event arrives). Same-origin
 * session auth, same as the SSE stream.
 */
export async function GET() {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const messages = await prisma.incomingMessage.findMany({
    orderBy: { receivedAt: 'desc' },
    take: RECENT_LIMIT,
    select: {
      channel: true,
      fromAddress: true,
      text: true,
      receivedAt: true,
      sequence: {
        select: { client: { select: { razonSocial: true } } },
      },
    },
  })

  const feed: LiveRecentResponse['feed'] = messages.map((m) => ({
    source: m.channel,
    sender: m.sequence?.client?.razonSocial ?? m.fromAddress,
    preview: m.text.slice(0, 120),
    at: m.receivedAt.toISOString(),
  }))

  return NextResponse.json<LiveRecentResponse>({ feed })
}
