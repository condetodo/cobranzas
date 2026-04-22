import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Bucket } from "@prisma/client"

const VALID_BUCKETS: Bucket[] = [
  Bucket.SIN_VENCER,
  Bucket.SUAVE,
  Bucket.FIRME,
  Bucket.AVISO_FINAL,
  Bucket.CRITICO,
]

/**
 * Devuelve los deudores del último TriageRun que pertenecen al bucket indicado.
 * Accepts ?segment=<bucket> for retrocompat con la UI (ex-segment filter), pero
 * el valor SIEMPRE es un enum Bucket válido — no hay más mapeos heurísticos de
 * nombres inventados por el Agent B, porque Agent B ahora devuelve targetBucket
 * directamente.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("segment") ?? req.nextUrl.searchParams.get("bucket")
  if (!raw) {
    return NextResponse.json({ error: "bucket required" }, { status: 400 })
  }

  if (!VALID_BUCKETS.includes(raw as Bucket)) {
    return NextResponse.json(
      { error: `bucket must be one of ${VALID_BUCKETS.join(", ")}` },
      { status: 400 }
    )
  }

  const bucket = raw as Bucket

  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: "desc" },
  })

  if (!latestRun) {
    return NextResponse.json([])
  }

  const snapshots = await prisma.debtorTriageSnapshot.findMany({
    where: {
      triageRunId: latestRun.id,
      bucket,
    },
    include: { client: true },
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
