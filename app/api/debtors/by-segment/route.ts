import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const segment = req.nextUrl.searchParams.get("segment")
  if (!segment) {
    return NextResponse.json({ error: "segment required" }, { status: 400 })
  }

  // Get latest triage run
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: "desc" },
  })

  if (!latestRun) {
    return NextResponse.json([])
  }

  // Find snapshots matching the segment bucket
  const snapshots = await prisma.debtorTriageSnapshot.findMany({
    where: {
      triageRunId: latestRun.id,
      bucket: segment as any,
    },
    include: {
      client: true,
    },
    orderBy: { score: "desc" },
  })

  const debtors = snapshots.map((s) => ({
    id: s.client.id,
    razonSocial: s.client.razonSocial,
    montoTotal: Number(s.montoTotal),
    bucket: s.bucket,
  }))

  return NextResponse.json(debtors)
}
