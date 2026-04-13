import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const autopilotOff = Boolean(body.autopilotOff)

  await prisma.client.update({
    where: { id },
    data: { autopilotOff },
  })

  return NextResponse.json({ ok: true, autopilotOff })
}
