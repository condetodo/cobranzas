"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  UserPlus,
  CircleCheck,
} from "lucide-react"
import type { EvolutionSummary, TransitionRow } from "@/lib/triage/evolution"
import type { Bucket } from "@prisma/client"

export function EvolutionPanel({
  evolution,
}: {
  evolution: EvolutionSummary
}) {
  const { totals, topTransitions } = evolution

  const hasMovement =
    totals.empeoraron + totals.mejoraron + totals.nuevos + totals.salieron > 0

  if (!hasMovement) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Evolución desde el último análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sin movimientos: todos los deudores se mantuvieron en el mismo
            bucket y no hubo entradas ni salidas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Evolución desde el último análisis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totales: 4 métricas en grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox
            label="Empeoraron"
            value={totals.empeoraron}
            tone="negative"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatBox
            label="Nuevos entrantes"
            value={totals.nuevos}
            tone="negative"
            icon={<UserPlus className="h-4 w-4" />}
          />
          <StatBox
            label="Mejoraron"
            value={totals.mejoraron}
            tone="positive"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatBox
            label="Salieron"
            value={totals.salieron}
            tone="positive"
            icon={<CircleCheck className="h-4 w-4" />}
            hint="pagaron / cerraron"
          />
        </div>

        {/* Top transiciones */}
        {topTransitions.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimientos principales
            </p>
            <ul className="space-y-1.5">
              {topTransitions.map((t, i) => (
                <TransitionLine key={i} transition={t} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatBox({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string
  value: number
  tone: "positive" | "negative" | "neutral"
  icon: React.ReactNode
  hint?: string
}) {
  const colorClass =
    tone === "negative"
      ? "text-red-600"
      : tone === "positive"
        ? "text-green-600"
        : "text-muted-foreground"

  return (
    <div className="rounded-lg border p-3">
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  )
}

function TransitionLine({ transition }: { transition: TransitionRow }) {
  const { fromBucket, toBucket, count } = transition

  // Nuevo entrante
  if (fromBucket === null && toBucket !== null) {
    const cfg = BUCKET_CONFIG[toBucket]
    return (
      <li className="flex items-center justify-between gap-2 text-sm rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5">
        <span className="flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-amber-700" />
          <span className="text-amber-900">Nuevos en</span>
          <Badge variant="outline" className={cfg.bgClass}>
            {cfg.label}
          </Badge>
        </span>
        <Link
          href={`/cartera?bucket=${toBucket}`}
          className="text-sm font-semibold text-amber-900 hover:underline tabular-nums"
        >
          {count}
        </Link>
      </li>
    )
  }

  // Salió (pagó/cerró)
  if (fromBucket !== null && toBucket === null) {
    const cfg = BUCKET_CONFIG[fromBucket]
    return (
      <li className="flex items-center justify-between gap-2 text-sm rounded-md border border-green-200 bg-green-50 px-3 py-1.5">
        <span className="flex items-center gap-2">
          <CircleCheck className="h-3.5 w-3.5 text-green-700" />
          <Badge variant="outline" className={cfg.bgClass}>
            {cfg.label}
          </Badge>
          <span className="text-green-900">→ salió (pagó / cerró)</span>
        </span>
        <span className="text-sm font-semibold text-green-900 tabular-nums">
          {count}
        </span>
      </li>
    )
  }

  // Transición entre buckets
  if (fromBucket !== null && toBucket !== null) {
    const fromCfg = BUCKET_CONFIG[fromBucket]
    const toCfg = BUCKET_CONFIG[toBucket]
    const isWorse =
      getSeverityRank(toBucket) > getSeverityRank(fromBucket)
    const toneClass = isWorse
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-blue-200 bg-blue-50 text-blue-900"
    const ArrowIcon = isWorse ? TrendingDown : TrendingUp
    const arrowColor = isWorse ? "text-red-700" : "text-blue-700"

    return (
      <li
        className={`flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-1.5 ${toneClass}`}
      >
        <span className="flex items-center gap-2">
          <ArrowIcon className={`h-3.5 w-3.5 ${arrowColor}`} />
          <Badge variant="outline" className={fromCfg.bgClass}>
            {fromCfg.label}
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className={toCfg.bgClass}>
            {toCfg.label}
          </Badge>
        </span>
        <Link
          href={`/cartera?bucket=${toBucket}`}
          className="text-sm font-semibold hover:underline tabular-nums"
        >
          {count}
        </Link>
      </li>
    )
  }

  return null
}

function getSeverityRank(b: Bucket): number {
  return { SIN_VENCER: 0, SUAVE: 1, FIRME: 2, AVISO_FINAL: 3, CRITICO: 4 }[b]
}
