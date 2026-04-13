import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      invoices: {
        where: { estado: "PENDING" },
        orderBy: { fechaVencimiento: "asc" },
      },
      outreachSequences: {
        where: { closedAt: null },
        take: 1,
        orderBy: { startedAt: "desc" },
        include: {
          attempts: { orderBy: { sentAt: "desc" } },
          incomingMessages: { orderBy: { receivedAt: "desc" } },
        },
      },
    },
  })

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const seq = client.outreachSequences[0]

  // Build timeline from attempts + incoming messages
  const timeline: Array<{
    type: string
    date: string
    channel: string
    text: string
  }> = []

  if (seq) {
    for (const attempt of seq.attempts) {
      const payload = attempt.rawPayload as Record<string, string> | null
      timeline.push({
        type: "outreach",
        date: attempt.sentAt.toISOString(),
        channel: attempt.channel,
        text: payload?.renderedMessage ?? `Template: ${attempt.templateCode}`,
      })
    }
    for (const msg of seq.incomingMessages) {
      timeline.push({
        type: "incoming",
        date: msg.receivedAt.toISOString(),
        channel: msg.channel,
        text: msg.text,
      })
    }
  }

  // Sort timeline chronologically
  timeline.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return NextResponse.json({
    invoices: client.invoices.map((inv) => ({
      id: inv.id,
      numero: inv.numero,
      fechaVencimiento: inv.fechaVencimiento.toISOString(),
      monto: inv.monto.toString(),
      estado: inv.estado,
    })),
    timeline,
    sequenceState: seq?.state ?? null,
  })
}
