"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS, formatNumber } from "@/lib/format"
import { ArrowRight } from "lucide-react"
import type { Bucket } from "@prisma/client"

interface Segmento {
  name: string
  count: number
  totalAmount: number
  ruleDescription: string
  bucket: string
}

export function SegmentCards({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Segmentos</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {segmentos.map((seg, i) => {
          const cfg = BUCKET_CONFIG[seg.bucket as Bucket] ?? {
            label: seg.bucket,
            bgClass: "bg-gray-100 text-gray-800",
          }
          return (
            <Card key={i} className="min-w-[260px] flex-shrink-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{seg.name}</CardTitle>
                  <Badge variant="outline" className={cfg.bgClass}>
                    {cfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deudores</span>
                  <span className="font-semibold">
                    {formatNumber(seg.count)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-semibold tabular-nums">
                    {formatARS(seg.totalAmount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {seg.ruleDescription}
                </p>
                <Link
                  href={`/cartera?bucket=${seg.bucket}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline pt-1"
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
