"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS, formatNumber, formatDateTime } from "@/lib/format"
import { ArrowUp, ArrowDown, Clock } from "lucide-react"
import type { Bucket } from "@prisma/client"

interface TriageRunData {
  id: string
  timestamp: Date
  source: string
  excelFileName: string | null
  totalDebtors: number
  totalAmount: { toString(): string }
  bucketCounts: unknown
  bucketAmounts: unknown
}

const BUCKETS: Bucket[] = [
  "SIN_VENCER",
  "SUAVE",
  "FIRME",
  "AVISO_FINAL",
  "CRITICO",
]

export function ScanSummaryCard({
  run,
  previousRun,
}: {
  run: TriageRunData
  previousRun: TriageRunData | null
}) {
  const counts = (run.bucketCounts ?? {}) as Record<string, number>
  const amounts = (run.bucketAmounts ?? {}) as Record<string, number>
  const prevCounts = (previousRun?.bucketCounts ?? {}) as Record<string, number>

  const totalAmount = Number(run.totalAmount.toString())
  const prevTotalAmount = previousRun
    ? Number(previousRun.totalAmount.toString())
    : null

  const amountDelta =
    prevTotalAmount !== null ? totalAmount - prevTotalAmount : null
  const debtorDelta = previousRun
    ? run.totalDebtors - previousRun.totalDebtors
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Resumen del escaneo</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(run.timestamp)}
            {run.excelFileName && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {run.excelFileName}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total deudores</p>
            <p className="text-2xl font-bold">
              {formatNumber(run.totalDebtors)}
            </p>
            {debtorDelta !== null && debtorDelta !== 0 && (
              <DeltaIndicator value={debtorDelta} suffix=" deudores" />
            )}
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Monto total</p>
            <p className="text-2xl font-bold">{formatARS(totalAmount)}</p>
            {amountDelta !== null && amountDelta !== 0 && (
              <DeltaIndicator value={amountDelta} prefix="$" isCurrency />
            )}
          </div>
        </div>

        {/* Bucket breakdown */}
        <div className="grid grid-cols-5 gap-2">
          {BUCKETS.map((bucket) => {
            const cfg = BUCKET_CONFIG[bucket]
            const count = counts[bucket] ?? 0
            const amount = amounts[bucket] ?? 0
            const prevCount = prevCounts[bucket] ?? 0
            const delta = previousRun ? count - prevCount : null
            return (
              <div
                key={bucket}
                className="rounded-lg border p-3 text-center"
              >
                <Badge variant="outline" className={cfg.bgClass + " mb-2"}>
                  {cfg.label}
                </Badge>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">
                  {formatARS(amount)}
                </p>
                {delta !== null && delta !== 0 && (
                  <DeltaIndicator value={delta} small />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function DeltaIndicator({
  value,
  prefix,
  suffix,
  isCurrency,
  small,
}: {
  value: number
  prefix?: string
  suffix?: string
  isCurrency?: boolean
  small?: boolean
}) {
  const isPositive = value > 0
  // For debtors/amount, more is "bad" (red up), less is "good" (green down)
  const color = isPositive ? "text-red-600" : "text-green-600"
  const Icon = isPositive ? ArrowUp : ArrowDown
  const display = isCurrency
    ? formatARS(Math.abs(value))
    : Math.abs(value).toLocaleString("es-AR")

  return (
    <div
      className={`flex items-center gap-0.5 ${color} ${
        small ? "text-[10px] justify-center mt-1" : "text-xs mt-1"
      }`}
    >
      <Icon className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>
        {isPositive ? "+" : "-"}
        {prefix}
        {display}
        {suffix}
      </span>
    </div>
  )
}
