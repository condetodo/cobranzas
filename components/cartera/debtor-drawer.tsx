"use client"

import { useEffect, useState, useTransition } from "react"
import type { DebtorRow } from "@/app/(app)/cartera/page"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS, formatDate, formatDateTime } from "@/lib/format"
import {
  Mail,
  Phone,
  PauseCircle,
  PlayCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Sparkles,
} from "lucide-react"

interface InvoiceData {
  id: string
  numero: string
  fechaVencimiento: string
  monto: string
  estado: string
}

interface TimelineEntry {
  type: "outreach" | "incoming"
  date: string
  channel: string
  text: string
}

interface DrawerData {
  invoices: InvoiceData[]
  timeline: TimelineEntry[]
  sequenceState: string | null
}

export function DebtorDrawer({
  debtor,
  onClose,
}: {
  debtor: DebtorRow | null
  onClose: () => void
}) {
  const [data, setData] = useState<DrawerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [toggling, startToggle] = useTransition()

  useEffect(() => {
    if (!debtor) {
      setData(null)
      return
    }
    setLoading(true)
    fetch(`/api/debtors/${debtor.id}/detail`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [debtor?.id])

  function handleToggleAutopilot() {
    if (!debtor) return
    startToggle(async () => {
      await fetch(`/api/debtors/${debtor.id}/autopilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autopilotOff: !debtor.autopilotOff }),
      })
      // Reload the page to reflect changes
      window.location.reload()
    })
  }

  const bucketCfg = debtor ? BUCKET_CONFIG[debtor.bucket] : null

  return (
    <Sheet open={!!debtor} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        {debtor && (
          <>
            <SheetHeader>
              <SheetTitle>{debtor.razonSocial}</SheetTitle>
              <SheetDescription>
                Cod: {debtor.cod}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {/* AI insight del Agent A */}
              {debtor.aiInsight && (
                <div className="flex gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-violet-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Insight IA
                    </p>
                    <p className="text-sm text-violet-900 mt-0.5">
                      {debtor.aiInsight}
                    </p>
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-2">
                {debtor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{debtor.email}</span>
                  </div>
                )}
                {debtor.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{debtor.telefono}</span>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Monto total</p>
                  <p className="text-lg font-bold">
                    {formatARS(debtor.montoTotal)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Segmento</p>
                  {bucketCfg && (
                    <Badge variant="outline" className={bucketCfg.bgClass + " mt-1"}>
                      {bucketCfg.label}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Autopilot toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Autopilot</p>
                  <p className="text-xs text-muted-foreground">
                    {debtor.autopilotOff
                      ? "Desactivado - gestion manual"
                      : "Activado - secuencia automatica"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={debtor.autopilotOff ? "default" : "outline"}
                  onClick={handleToggleAutopilot}
                  disabled={toggling}
                >
                  {toggling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : debtor.autopilotOff ? (
                    <>
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Activar
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4 mr-1" />
                      Desactivar
                    </>
                  )}
                </Button>
              </div>

              <Separator />

              {/* Pending invoices */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Facturas pendientes
                </h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : data?.invoices && data.invoices.length > 0 ? (
                  <div className="space-y-2">
                    {data.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">#{inv.numero}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {formatDate(inv.fechaVencimiento)}
                          </p>
                        </div>
                        <p className="tabular-nums">
                          {formatARS(inv.monto)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin facturas cargadas.
                  </p>
                )}
              </div>

              <Separator />

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Historial de comunicaciones
                </h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : data?.timeline && data.timeline.length > 0 ? (
                  <div className="space-y-3">
                    {data.timeline.map((entry, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="mt-0.5">
                          {entry.type === "outreach" ? (
                            <ArrowUpRight className="h-4 w-4 text-blue-500" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {entry.channel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(entry.date)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate">
                            {entry.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin comunicaciones registradas.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
