"use client"

import { useState } from "react"
import type { DebtorRow } from "@/app/(app)/cartera/page"
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
import { Bot, PauseCircle } from "lucide-react"

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
              <TableHead className="w-[250px]">Razon Social</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
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
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron deudores.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((debtor, idx) => {
                const bucketCfg = BUCKET_CONFIG[debtor.bucket]
                return (
                  <TableRow
                    key={debtor.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedDebtor(debtor)}
                  >
                    <TableCell className="font-medium">
                      {debtor.razonSocial}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatARS(debtor.montoTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {debtor.diasVencidoMax}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={bucketCfg.bgClass}
                      >
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
