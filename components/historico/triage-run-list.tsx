"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS, formatDateTime, formatNumber } from "@/lib/format"
import { FileSpreadsheet, RefreshCw, ArrowUp, ArrowDown } from "lucide-react"
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

export function TriageRunList({ runs }: { runs: TriageRunData[] }) {
  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Deudores</TableHead>
            <TableHead>Monto total</TableHead>
            <TableHead>Segmentos</TableHead>
            <TableHead>Delta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run, idx) => {
            const counts = (run.bucketCounts ?? {}) as Record<string, number>
            const totalAmount = Number(run.totalAmount.toString())
            const prevRun = runs[idx + 1] // next in list is previous in time
            const prevTotal = prevRun
              ? Number(prevRun.totalAmount.toString())
              : null
            const delta =
              prevTotal !== null ? totalAmount - prevTotal : null

            return (
              <TableRow key={run.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(run.timestamp)}
                </TableCell>
                <TableCell>
                  {run.source === "IMPORT" ? (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      Import
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-gray-50 text-gray-700 border-gray-200"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Manual
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {run.excelFileName ?? "-"}
                </TableCell>
                <TableCell>
                  {formatNumber(run.totalDebtors)}
                </TableCell>
                <TableCell className="font-mono">
                  {formatARS(totalAmount)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {BUCKETS.map((bucket) => {
                      const count = counts[bucket] ?? 0
                      if (count === 0) return null
                      const cfg = BUCKET_CONFIG[bucket]
                      return (
                        <Badge
                          key={bucket}
                          variant="outline"
                          className={cfg.bgClass + " text-[10px] px-1.5 py-0"}
                        >
                          {count}
                        </Badge>
                      )
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  {delta !== null && delta !== 0 ? (
                    <div
                      className={`flex items-center gap-0.5 text-xs ${
                        delta > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {delta > 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {formatARS(Math.abs(delta))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
