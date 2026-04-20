"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ClientRow } from "@/app/(app)/clientes/page"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatARS, formatDate, formatDateTime } from "@/lib/format"
import {
  Loader2,
  Save,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  FileCheck2,
  PauseCircle,
  PlayCircle,
} from "lucide-react"

interface InvoiceDetail {
  id: string
  numero: string
  fechaEmision: string
  fechaVencimiento: string
  monto: number
  paidAmount: number
  paidAt: string | null
  estado: "PENDING" | "PAID" | "CANCELLED"
  moneda: string
}

interface SequenceDetail {
  id: string
  state: string
  currentBucket: string
  startedAt: string
  closedAt: string | null
  closedReason: string | null
  escalationReason: string | null
  attemptCount: number
  incomingCount: number
}

type ActivityEntry =
  | {
      kind: "outreach"
      date: string
      channel: string
      templateCode: string
      body: string
      sequenceId: string
    }
  | {
      kind: "incoming"
      date: string
      channel: string
      category: string | null
      body: string
      sequenceId: string
    }
  | {
      kind: "confirmation"
      date: string
      decision: string
      amount: number | null
      rejectionReason: string | null
      sequenceId: string
    }

interface ClientDetail {
  client: {
    id: string
    cod: string
    razonSocial: string
    email: string | null
    telefono: string | null
    telegram: string | null
    categoria: string | null
    autopilotOff: boolean
    createdAt: string
    updatedAt: string
  }
  invoices: InvoiceDetail[]
  sequences: SequenceDetail[]
  activity: ActivityEntry[]
}

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

const CLOSED_REASON_LABELS: Record<string, string> = {
  PAID: "Pago confirmado",
  PARTIAL_PAID_CONTINUING: "Pago parcial",
  ESCALATED: "Escalado",
  MANUAL_OVERRIDE: "Cierre manual",
}

export function ClientDrawer({
  summary,
  onClose,
}: {
  summary: ClientRow | null
  onClose: () => void
}) {
  const [data, setData] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!summary) {
      setData(null)
      return
    }
    setLoading(true)
    fetch(`/api/clients/${summary.id}/detail`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [summary?.id])

  return (
    <Sheet open={!!summary} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        {summary && (
          <>
            <SheetHeader>
              <SheetTitle>{summary.razonSocial}</SheetTitle>
              <SheetDescription>
                Codigo: <span className="tabular-nums">{summary.cod}</span>
              </SheetDescription>
            </SheetHeader>

            {loading && !data ? (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando datos del cliente...
              </div>
            ) : data ? (
              <Tabs defaultValue="datos" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="datos">Datos</TabsTrigger>
                  <TabsTrigger value="facturas">
                    Facturas ({data.invoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="secuencias">
                    Secuencias ({data.sequences.length})
                  </TabsTrigger>
                  <TabsTrigger value="actividad">
                    Actividad ({data.activity.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="datos" className="mt-4">
                  <DatosTab detail={data} onSaved={() => {
                    // refresh local data after save
                    if (summary) {
                      fetch(`/api/clients/${summary.id}/detail`)
                        .then((r) => r.json())
                        .then(setData)
                        .catch(() => {})
                    }
                  }} />
                </TabsContent>

                <TabsContent value="facturas" className="mt-4">
                  <InvoicesTab invoices={data.invoices} />
                </TabsContent>

                <TabsContent value="secuencias" className="mt-4">
                  <SequencesTab sequences={data.sequences} />
                </TabsContent>

                <TabsContent value="actividad" className="mt-4">
                  <ActivityTab activity={data.activity} />
                </TabsContent>
              </Tabs>
            ) : (
              <p className="mt-6 text-sm text-red-600">
                No se pudo cargar el detalle del cliente.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DatosTab({
  detail,
  onSaved,
}: {
  detail: ClientDetail
  onSaved: () => void
}) {
  const { client } = detail
  const router = useRouter()
  const [form, setForm] = useState({
    razonSocial: client.razonSocial,
    email: client.email ?? "",
    telefono: client.telefono ?? "",
    telegram: client.telegram ?? "",
    categoria: client.categoria ?? "",
  })
  const [autopilotOff, setAutopilotOff] = useState(client.autopilotOff)
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty =
    form.razonSocial !== client.razonSocial ||
    form.email !== (client.email ?? "") ||
    form.telefono !== (client.telefono ?? "") ||
    form.telegram !== (client.telegram ?? "") ||
    form.categoria !== (client.categoria ?? "") ||
    autopilotOff !== client.autopilotOff

  function handleSave() {
    startSave(async () => {
      setError(null)
      setSaved(false)
      try {
        const res = await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razonSocial: form.razonSocial,
            email: form.email,
            telefono: form.telefono,
            telegram: form.telegram,
            categoria: form.categoria,
            autopilotOff,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data?.error ?? "No se pudo guardar")
          return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        onSaved()
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? "Error de conexion")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="c-cod">Codigo</Label>
        <Input
          id="c-cod"
          value={client.cod}
          disabled
          className="tabular-nums text-sm"
        />
        <p className="text-xs text-muted-foreground">
          El codigo no es editable. Es la clave con la que se matchea al re-importar el Excel.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="c-rs">Razon Social *</Label>
        <Input
          id="c-rs"
          value={form.razonSocial}
          onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="cliente@empresa.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-tel">Telefono</Label>
          <Input
            id="c-tel"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+54911..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="c-tg">Telegram</Label>
          <Input
            id="c-tg"
            value={form.telegram}
            onChange={(e) => setForm({ ...form, telegram: e.target.value })}
            placeholder="@usuario"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-cat">Categoria</Label>
          <Input
            id="c-cat"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            placeholder="A / B / C"
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Autopilot</p>
          <p className="text-xs text-muted-foreground">
            {autopilotOff
              ? "Desactivado - no se envian mensajes automaticos"
              : "Activado - la secuencia corre normal"}
          </p>
        </div>
        <Button
          size="sm"
          variant={autopilotOff ? "default" : "outline"}
          onClick={() => setAutopilotOff(!autopilotOff)}
          type="button"
        >
          {autopilotOff ? (
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

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={!isDirty || saving} size="sm">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Guardar cambios
            </>
          )}
        </Button>
        {saved && (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Guardado
          </div>
        )}
      </div>
    </div>
  )
}

function InvoicesTab({ invoices }: { invoices: InvoiceDetail[] }) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Este cliente no tiene facturas cargadas.
      </p>
    )
  }

  const estadoColor: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    PAID: "bg-green-50 text-green-700 border-green-200",
    CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv) => (
        <div key={inv.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm font-medium">#{inv.numero}</span>
              <Badge
                variant="outline"
                className={`text-xs ${estadoColor[inv.estado] ?? ""}`}
              >
                {inv.estado}
              </Badge>
            </div>
            <span className="tabular-nums text-sm font-semibold">
              {formatARS(inv.monto)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Emision {formatDate(inv.fechaEmision)} · Vence{" "}
              {formatDate(inv.fechaVencimiento)}
            </span>
            {inv.paidAmount > 0 && inv.estado === "PENDING" && (
              <span className="text-blue-700">
                Pagado parcial: {formatARS(inv.paidAmount)}
              </span>
            )}
            {inv.paidAt && (
              <span>Pagada el {formatDate(inv.paidAt)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SequencesTab({ sequences }: { sequences: SequenceDetail[] }) {
  if (sequences.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Este cliente no tuvo secuencias de cobranza todavia.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {sequences.map((seq) => {
        const isActive = seq.closedAt === null
        return (
          <div key={seq.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {STATE_LABELS[seq.state] ?? seq.state}
                </Badge>
                {isActive && (
                  <span className="text-xs font-medium text-green-700">
                    Activa
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {seq.attemptCount} envios · {seq.incomingCount} respuestas
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>
                Inicio: {formatDateTime(seq.startedAt)}
              </div>
              {seq.closedAt && (
                <div>
                  Cierre: {formatDateTime(seq.closedAt)}{" "}
                  {seq.closedReason && (
                    <>
                      · motivo:{" "}
                      {CLOSED_REASON_LABELS[seq.closedReason] ?? seq.closedReason}
                    </>
                  )}
                </div>
              )}
              {seq.escalationReason && (
                <div className="text-amber-700">
                  Razon de escalamiento: {seq.escalationReason}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActivityTab({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Sin actividad registrada todavia.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {activity.map((entry, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <div className="mt-0.5">
            {entry.kind === "outreach" && (
              <ArrowUpRight className="h-4 w-4 text-blue-500" />
            )}
            {entry.kind === "incoming" && (
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
            )}
            {entry.kind === "confirmation" && (
              <FileCheck2 className="h-4 w-4 text-purple-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.kind === "outreach" && (
                <>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {entry.channel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {entry.templateCode}
                  </Badge>
                </>
              )}
              {entry.kind === "incoming" && (
                <>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {entry.channel}
                  </Badge>
                  {entry.category && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-green-200 bg-green-50 text-green-700"
                    >
                      {entry.category}
                    </Badge>
                  )}
                </>
              )}
              {entry.kind === "confirmation" && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-purple-200 bg-purple-50 text-purple-700"
                >
                  Contador: {entry.decision}
                  {entry.amount !== null && ` · ${formatARS(entry.amount)}`}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(entry.date)}
              </span>
            </div>
            {entry.kind === "confirmation" && entry.rejectionReason && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Motivo: {entry.rejectionReason}
              </p>
            )}
            {entry.kind !== "confirmation" && entry.body && (
              <p className="text-muted-foreground mt-0.5 text-xs line-clamp-3">
                {entry.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
