"use client"

import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import type { DebtorRow, DebtorInvoice } from "@/app/(app)/cartera/page"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DebtorFilters } from "./debtor-filters"
import { DebtorDrawer } from "./debtor-drawer"
import { BUCKET_CONFIG } from "@/lib/bucket-colors"
import { formatARS } from "@/lib/format"
import {
  Bot,
  PauseCircle,
  ChevronRight,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react"

const STATE_LABELS: Record<string, string> = {
  SCHEDULED: "Programado",
  SENT_SOFT: "Enviado suave",
  SENT_FIRM: "Enviado firme",
  SENT_FINAL: "Enviado final",
  IN_CONVERSATION: "En conversacion",
  AWAITING_ACCOUNTANT: "Esperando contador",
  PAID: "Pagado",
  PARTIAL_PAID_CONTINUING: "Pago parcial",
  ESCALATED_TO_HUMAN: "Escalado",
  AUTOPILOT_OFF: "Autopilot off",
  CLOSED: "Cerrado",
}

export function DebtorTable({ debtors }: { debtors: DebtorRow[] }) {
  const [search, setSearch] = useState("")
  const [bucket, setBucket] = useState("ALL")
  const [autopilotOffOnly, setAutopilotOffOnly] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorRow | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter
  const filtered = debtors.filter((d) => {
    if (
      search &&
      !d.razonSocial.toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (bucket !== "ALL" && d.bucket !== bucket) return false
    if (autopilotOffOnly && !d.autopilotOff) return false
    return true
  })

  return (
    <>
      <DebtorFilters
        search={search}
        onSearchChange={setSearch}
        bucket={bucket}
        onBucketChange={setBucket}
        autopilotOffOnly={autopilotOffOnly}
        onAutopilotOffChange={setAutopilotOffOnly}
      />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="w-[230px]">Razon Social</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Facturas</TableHead>
              <TableHead className="text-right">Dias Vencido</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[60px] text-center">IA</TableHead>
              <TableHead className="w-[60px] text-center">AP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron deudores.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((debtor, idx) => {
                const bucketCfg = BUCKET_CONFIG[debtor.bucket]
                const isExpanded = expandedIds.has(debtor.id)
                const hasPartial = debtor.invoices.some((inv) => inv.paidAmount > 0)

                return (
                  <Fragment key={debtor.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setSelectedDebtor(debtor)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(debtor.id)
                          }}
                          aria-label={
                            isExpanded ? "Colapsar facturas" : "Ver facturas"
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {debtor.razonSocial}
                          {hasPartial && (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700 text-xs"
                            >
                              Pago parcial
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatARS(debtor.montoTotal)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {debtor.invoiceCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {debtor.diasVencidoMax}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={bucketCfg.bgClass}>
                          {bucketCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {debtor.sequenceState ? (
                          <Badge variant="secondary">
                            {STATE_LABELS[debtor.sequenceState] ??
                              debtor.sequenceState}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin secuencia
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {debtor.aiInsight && idx < 50 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center rounded-md p-1 hover:bg-gray-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Bot className="h-4 w-4 text-blue-600" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-80 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="font-medium mb-1">AI Insight</p>
                              <p className="text-muted-foreground">
                                {debtor.aiInsight}
                              </p>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {debtor.autopilotOff && (
                          <PauseCircle className="h-4 w-4 text-amber-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableCell />
                        <TableCell colSpan={8} className="py-3">
                          <InvoiceList invoices={debtor.invoices} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DebtorDrawer
        debtor={selectedDebtor}
        onClose={() => setSelectedDebtor(null)}
      />
    </>
  )
}

function InvoiceList({ invoices }: { invoices: DebtorInvoice[] }) {
  const router = useRouter()
  const [markingId, setMarkingId] = useState<string | null>(null)

  async function handleMarkPaid(inv: DebtorInvoice) {
    const ok = window.confirm(
      `¿Marcar la factura ${inv.numero} (${formatARS(inv.saldo)}) como cobrada?\n\n` +
        `Esta acción no se puede deshacer desde la UI.`
    )
    if (!ok) return

    setMarkingId(inv.id)
    try {
      const res = await fetch(`/api/invoices/${inv.id}/mark-paid`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Error: ${data?.error ?? "no se pudo marcar la factura"}`)
        return
      }
      router.refresh()
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "falló la conexión"}`)
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Facturas pendientes ({invoices.length})
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="text-left py-1 pr-4 font-medium">Numero</th>
            <th className="text-left py-1 pr-4 font-medium">Vencimiento</th>
            <th className="text-right py-1 pr-4 font-medium">Dias vencida</th>
            <th className="text-right py-1 pr-4 font-medium">Monto</th>
            <th className="text-right py-1 pr-4 font-medium">Pagado</th>
            <th className="text-right py-1 pr-4 font-medium">Saldo</th>
            <th className="text-right py-1 font-medium w-[140px]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const isMarking = markingId === inv.id
            return (
              <tr key={inv.id} className="border-t border-gray-200">
                <td className="py-1.5 pr-4 tabular-nums">{inv.numero}</td>
                <td className="py-1.5 pr-4">
                  {new Date(inv.fechaVencimiento).toLocaleDateString("es-AR")}
                </td>
                <td className="py-1.5 pr-4 text-right">
                  {inv.diasVencido > 0 ? (
                    <span className="text-amber-700">{inv.diasVencido}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {formatARS(inv.monto)}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {inv.paidAmount > 0 ? (
                    <span className="text-blue-700">
                      {formatARS(inv.paidAmount)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums font-semibold">
                  {formatARS(inv.saldo)}
                </td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    disabled={isMarking || markingId !== null}
                    onClick={() => handleMarkPaid(inv)}
                    className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isMarking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Marcar pagada
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
