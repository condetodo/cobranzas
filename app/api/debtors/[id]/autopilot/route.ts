import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await req.json()
    const autopilotOff = Boolean(body.autopilotOff)

    await prisma.client.update({
      where: { id },
      data: { autopilotOff },
    })

    return NextResponse.json({ ok: true, autopilotOff })
  } catch (err: any) {
    console.error('autopilot toggle error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error toggling autopilot' },
      { status: 500 }
    )
  }
}
