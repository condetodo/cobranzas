import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Bucket } from "@prisma/client"

// Map common segment names from AI to bucket enums
const SEGMENT_TO_BUCKETS: Record<string, Bucket[]> = {
  // Direct bucket matches
  "SIN_VENCER": [Bucket.SIN_VENCER],
  "SUAVE": [Bucket.SUAVE],
  "FIRME": [Bucket.FIRME],
  "AVISO_FINAL": [Bucket.AVISO_FINAL],
  "CRITICO": [Bucket.CRITICO],
  // AI-generated segment names (Spanish, flexible matching)
  "Deudores Críticos": [Bucket.CRITICO, Bucket.AVISO_FINAL],
  "Deudores Medianos en Riesgo": [Bucket.FIRME],
  "Deudores Menores": [Bucket.SUAVE, Bucket.SIN_VENCER],
}

function resolveBuckets(segment: string): Bucket[] | null {
  // Exact match first
  if (SEGMENT_TO_BUCKETS[segment]) return SEGMENT_TO_BUCKETS[segment]
  // Case-insensitive partial match
  const lower = segment.toLowerCase()
  for (const [key, buckets] of Object.entries(SEGMENT_TO_BUCKETS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return buckets
    }
  }
  // Keyword matching
  if (lower.includes("crític") || lower.includes("critic") || lower.includes("urgent")) return [Bucket.CRITICO, Bucket.AVISO_FINAL]
  if (lower.includes("firme") || lower.includes("median") || lower.includes("riesgo")) return [Bucket.FIRME]
  if (lower.includes("suave") || lower.includes("menor") || lower.includes("preven")) return [Bucket.SUAVE, Bucket.SIN_VENCER]
  // Fallback: return all buckets
  return Object.values(Bucket)
}

export async function GET(req: NextRequest) {
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

  const buckets = resolveBuckets(segment)

  // Find snapshots matching the segment bucket(s)
  const snapshots = await prisma.debtorTriageSnapshot.findMany({
    where: {
      triageRunId: latestRun.id,
      bucket: { in: buckets ?? undefined },
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
