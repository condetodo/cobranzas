"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatARS } from "@/lib/format"
import { Loader2, Send, CheckCircle2, XCircle } from "lucide-react"

interface Action {
  title: string
  description: string
  targetSegment: string
  templateCode: string
}

interface Debtor {
  id: string
  razonSocial: string
  montoTotal: number
  bucket: string
}

type LaunchState = "idle" | "loading" | "sending" | "done" | "error"

const TEMPLATE_OPTIONS = [
  { value: "soft", label: "Recordatorio suave" },
  { value: "firm", label: "Aviso firme" },
  { value: "final", label: "Aviso final" },
]

export function CampaignModal({
  action,
  onClose,
}: {
  action: Action | null
  onClose: () => void
}) {
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState("")
  const [state, setState] = useState<LaunchState>("idle")
  const [result, setResult] = useState<{
    sent: number
    skipped: number
    failed: number
  } | null>(null)

  useEffect(() => {
    if (!action) {
      setDebtors([])
      setSelected(new Set())
      setState("idle")
      setResult(null)
      return
    }
    setTemplate(action.templateCode)
    setState("loading")
    fetch(`/api/debtors/by-segment?segment=${action.targetSegment}`)
      .then((r) => r.json())
      .then((data: Debtor[]) => {
        setDebtors(data)
        setSelected(new Set(data.map((d) => d.id)))
        setState("idle")
      })
      .catch(() => setState("idle"))
  }, [action])

  function toggleDebtor(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === debtors.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(debtors.map((d) => d.id)))
    }
  }

  async function handleSend() {
    setState("sending")
    try {
      const res = await fetch("/api/campaigns/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtorIds: Array.from(selected),
          templateCode: template,
        }),
      })
      const data = await res.json()
      setResult(data)
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ejecutar campana</DialogTitle>
          <DialogDescription>
            {action?.title} - {action?.targetSegment}
          </DialogDescription>
        </DialogHeader>

        {state === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {(state === "idle" || state === "sending") && (
          <>
            {/* Template selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Debtors list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Deudores ({selected.size}/{debtors.length})
                </label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selected.size === debtors.length
                    ? "Deseleccionar todos"
                    : "Seleccionar todos"}
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto rounded-md border divide-y">
                {debtors.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(d.id)}
                      onCheckedChange={() => toggleDebtor(d.id)}
                    />
                    <span className="flex-1 text-sm">{d.razonSocial}</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatARS(d.montoTotal)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {state === "done" && result && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Campana ejecutada</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold text-green-600">
                  {result.sent}
                </p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold text-yellow-600">
                  {result.skipped}
                </p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold text-red-600">
                  {result.failed}
                </p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <XCircle className="h-5 w-5" />
            <p className="font-medium">Error al ejecutar la campana</p>
          </div>
        )}

        <DialogFooter>
          {state === "done" || state === "error" ? (
            <Button onClick={onClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={state === "sending" || selected.size === 0}
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Enviar ({selected.size})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
