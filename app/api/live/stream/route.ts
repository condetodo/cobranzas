import { auth } from '@/lib/auth'
import { liveActivity } from '@/lib/live/activity-bus'
import type { LiveEvent } from '@/lib/live/types'

// Long-lived SSE connection — must run on the Node runtime (not edge) and never
// be statically cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 25_000

/**
 * GET /api/live/stream — Server-Sent Events stream of live activity.
 *
 * Same-origin, so the browser's EventSource sends the next-auth session cookie
 * automatically; we just check the session here. No token / proxy needed (the
 * dashboard and the backend are the same Next.js process).
 */
export async function GET() {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Controller already closed (client gone mid-write) — ignore.
        }
      }

      // Initial ping so proxies flush headers and the client flips to connected.
      send('event: ping\ndata: connected\n\n')

      // Forward every bus event as an SSE `data:` line. Listener is synchronous.
      unsubscribe = liveActivity.subscribe((event: LiveEvent) => {
        send(`data: ${JSON.stringify(event)}\n\n`)
      })

      // Keep the connection alive through idle periods and proxy timeouts.
      heartbeat = setInterval(() => {
        send(`event: ping\ndata: ${Date.now()}\n\n`)
      }, HEARTBEAT_MS)
    },
    cancel() {
      // Client disconnected — tear everything down.
      if (heartbeat) clearInterval(heartbeat)
      if (unsubscribe) unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Critical: stop reverse proxies (nginx/Railway edge) from buffering SSE.
      'X-Accel-Buffering': 'no',
    },
  })
}
