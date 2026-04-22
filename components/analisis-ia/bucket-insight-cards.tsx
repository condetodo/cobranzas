"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS, formatNumber } from "@/lib/format"
import { ArrowRight, Sparkles } from "lucide-react"
import type { Bucket } from "@prisma/client"

const BUCKET_ORDER: Bucket[] = [
  "SIN_VENCER",
  "SUAVE",
  "FIRME",
  "AVISO_FINAL",
  "CRITICO",
]

interface BucketInsight {
  bucket: string
  insight: string
}

interface Props {
  insights: BucketInsight[]
  bucketCounts: Record<string, number>
  bucketAmounts: Record<string, number>
}

export function BucketInsightCards({
  insights,
  bucketCounts,
  bucketAmounts,
}: Props) {
  const insightByBucket = new Map(insights.map((i) => [i.bucket, i.insight]))

  const activeBuckets = BUCKET_ORDER.filter(
    (b) => (bucketCounts[b] ?? 0) > 0
  )

  if (activeBuckets.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Análisis por segmento</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeBuckets.map((bucket) => {
          const cfg = BUCKET_CONFIG[bucket]
          const count = bucketCounts[bucket] ?? 0
          const amount = bucketAmounts[bucket] ?? 0
          const insight = insightByBucket.get(bucket)

          return (
            <Card key={bucket}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cfg.label}</CardTitle>
                  <Badge variant="outline" className={cfg.bgClass}>
                    {formatNumber(count)} deudor{count === 1 ? "" : "es"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xl font-bold tabular-nums">
                  {formatARS(amount)}
                </p>
                {insight ? (
                  <div className="flex gap-2 rounded-md bg-violet-50 border border-violet-200 p-2">
                    <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-600" />
                    <p className="text-xs text-violet-900 leading-snug">
                      {insight}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Sin insight específico para este segmento.
                  </p>
                )}
                <Link
                  href={`/cartera?bucket=${bucket}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Ver deudores
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
