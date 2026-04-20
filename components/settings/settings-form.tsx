"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, CheckCircle2, Wifi, AlertTriangle } from "lucide-react"
import type {
  AgingThresholds,
  SequenceTimeouts,
  SequenceChannels,
  StageChannel,
  BusinessHours,
} from "@/lib/config"

interface SettingsFormProps {
  agingThresholds: AgingThresholds
  sequenceTimeouts: SequenceTimeouts
  sequenceChannels: SequenceChannels
  maxSendFailures: number
  businessHours: BusinessHours
  demoFastMode: boolean
  contadorEmail: string
  whatsappUrl: string
  templates: Record<string, string>
}

export function SettingsForm({
  agingThresholds: initialAging,
  sequenceTimeouts: initialTimeouts,
  sequenceChannels: initialChannels,
  maxSendFailures: initialMaxFailures,
  businessHours: initialBusinessHours,
  demoFastMode: initialFastMode,
  contadorEmail: initialEmail,
  whatsappUrl: initialWhatsapp,
  templates: initialTemplates,
}: SettingsFormProps) {
  const [aging, setAging] = useState(initialAging)
  const [timeouts, setTimeouts] = useState(initialTimeouts)
  const [channels, setChannels] = useState(initialChannels)
  const [maxFailures, setMaxFailures] = useState(initialMaxFailures)
  const [businessHours, setBusinessHours] = useState(initialBusinessHours)
  const [fastMode, setFastMode] = useState(initialFastMode)
  const [email, setEmail] = useState(initialEmail)
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp)
  const [templates, setTemplates] = useState(initialTemplates)
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)
  const [testingWa, setTestingWa] = useState(false)
  const [waResult, setWaResult] = useState<string | null>(null)

  function handleSave() {
    startSave(async () => {
      setSaved(false)
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "aging.thresholds": aging,
          "sequence.timeouts": timeouts,
          "sequence.channels": channels,
          "sequence.maxSendFailures": maxFailures,
          "business.hours": businessHours,
          "demo.fastMode": fastMode,
          "contador.email": email,
          "whatsapp.demo.url": whatsapp,
          "templates.copy": templates,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  async function testWhatsapp() {
    setTestingWa(true)
    setWaResult(null)
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: whatsapp }),
      })
      if (res.ok) {
        setWaResult("Conexion exitosa")
      } else {
        setWaResult("Error de conexion")
      }
    } catch {
      setWaResult("Error de conexion")
    } finally {
      setTestingWa(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Aging thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Umbrales de aging (dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aging-suave">Suave</Label>
              <Input
                id="aging-suave"
                type="number"
                value={aging.suave}
                onChange={(e) =>
                  setAging({ ...aging, suave: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aging-firme">Firme</Label>
              <Input
                id="aging-firme"
                type="number"
                value={aging.firme}
                onChange={(e) =>
                  setAging({ ...aging, firme: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aging-aviso">Aviso final</Label>
              <Input
                id="aging-aviso"
                type="number"
                value={aging.avisoFinal}
                onChange={(e) =>
                  setAging({ ...aging, avisoFinal: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email del contador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email del contador</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="email"
            placeholder="contador@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* WhatsApp Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://whatsapp-api-url.example.com"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={testWhatsapp}
              disabled={testingWa || !whatsapp}
            >
              {testingWa ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-1" />
              )}
              Probar conexion
            </Button>
          </div>
          {waResult && (
            <p
              className={`text-sm ${
                waResult.includes("exitosa")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {waResult}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sequence timeouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Timeouts de secuencias ({fastMode ? "segundos" : "días"})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-soft">Suave a Firme</Label>
              <Input
                id="t-soft"
                type="number"
                value={timeouts.softToFirm}
                onChange={(e) =>
                  setTimeouts({
                    ...timeouts,
                    softToFirm: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-firm">Firme a Final</Label>
              <Input
                id="t-firm"
                type="number"
                value={timeouts.firmToFinal}
                onChange={(e) =>
                  setTimeouts({
                    ...timeouts,
                    firmToFinal: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-final">Final a Escalado</Label>
              <Input
                id="t-final"
                type="number"
                value={timeouts.finalToEscalated}
                onChange={(e) =>
                  setTimeouts({
                    ...timeouts,
                    finalToEscalated: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-conv">En conversación</Label>
              <Input
                id="t-conv"
                type="number"
                value={timeouts.inConversation}
                onChange={(e) =>
                  setTimeouts({
                    ...timeouts,
                    inConversation: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>En conversación</strong>: si el deudor deja de responder después de entrar en conversación, se escala al humano pasado este tiempo.
          </p>

          <Separator />

          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3">
            <input
              id="demo-fastmode"
              type="checkbox"
              className="mt-1 h-4 w-4 cursor-pointer"
              checked={fastMode}
              onChange={(e) => setFastMode(e.target.checked)}
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="demo-fastmode" className="cursor-pointer font-medium">
                Modo demo (acelerar flow)
              </Label>
              <p className="text-xs text-muted-foreground">
                Con el toggle activado, los mismos valores de timeout se
                interpretan como <strong>segundos</strong> en lugar de{" "}
                <strong>días</strong>. Útil para demostrar el flujo en vivo.
              </p>
              {fastMode && (
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Modo demo activo — las secuencias se disparan en segundos. Desactivar antes de producción.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canales por instancia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canal por instancia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Definí por qué canal se contacta al deudor en cada etapa de la secuencia. Podés, por ejemplo, empezar por email y escalar a WhatsApp en el aviso final.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {(["soft", "firm", "final"] as const).map((stage) => (
              <div key={stage} className="space-y-2">
                <Label className="capitalize">
                  {stage === "soft" ? "Suave" : stage === "firm" ? "Firme" : "Final"}
                </Label>
                <Select
                  value={channels[stage]}
                  onValueChange={(v) =>
                    setChannels({ ...channels, [stage]: v as StageChannel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Máximo de fallos antes de escalar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tolerancia a fallos de envío</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="max-failures">
            Cantidad máxima de fallos antes de escalar al humano
          </Label>
          <Input
            id="max-failures"
            type="number"
            min={1}
            value={maxFailures}
            onChange={(e) => setMaxFailures(Number(e.target.value))}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Si el canal falla N veces seguidas al intentar enviar (ej: email inválido, bot caído), la secuencia se marca como escalada para revisión manual.
          </p>
        </CardContent>
      </Card>

      {/* Horarios hábiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horarios hábiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            El runner automático solo envía mensajes dentro de esta ventana. Los envíos manuales desde la UI no se ven afectados. Con <strong>modo demo activo</strong>, la ventana se ignora.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="bh-start">Desde</Label>
              <Input
                id="bh-start"
                type="time"
                value={businessHours.start}
                onChange={(e) =>
                  setBusinessHours({ ...businessHours, start: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bh-end">Hasta</Label>
              <Input
                id="bh-end"
                type="time"
                value={businessHours.end}
                onChange={(e) =>
                  setBusinessHours({ ...businessHours, end: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Días de la semana</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { idx: 1, label: "Lun" },
                  { idx: 2, label: "Mar" },
                  { idx: 3, label: "Mié" },
                  { idx: 4, label: "Jue" },
                  { idx: 5, label: "Vie" },
                  { idx: 6, label: "Sáb" },
                  { idx: 0, label: "Dom" },
                ] as const
              ).map(({ idx, label }) => {
                const active = businessHours.weekdays.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setBusinessHours({
                        ...businessHours,
                        weekdays: active
                          ? businessHours.weekdays.filter((d) => d !== idx)
                          : [...businessHours.weekdays, idx].sort(),
                      })
                    }
                    className={`rounded-md border px-3 py-1 text-sm transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <Label htmlFor="bh-tz">Timezone (IANA)</Label>
            <Input
              id="bh-tz"
              type="text"
              value={businessHours.timezone}
              onChange={(e) =>
                setBusinessHours({ ...businessHours, timezone: e.target.value })
              }
              placeholder="America/Argentina/Buenos_Aires"
            />
            <p className="text-xs text-muted-foreground">
              Nombre de zona horaria en formato IANA. Default: <code>America/Argentina/Buenos_Aires</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates de mensajes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-soft">Recordatorio suave</Label>
            <Textarea
              id="tpl-soft"
              rows={4}
              placeholder="Hola {{razonSocial}}, le recordamos..."
              value={templates.soft ?? ""}
              onChange={(e) =>
                setTemplates({ ...templates, soft: e.target.value })
              }
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="tpl-firm">Aviso firme</Label>
            <Textarea
              id="tpl-firm"
              rows={4}
              placeholder="Estimado {{razonSocial}}, notamos que..."
              value={templates.firm ?? ""}
              onChange={(e) =>
                setTemplates({ ...templates, firm: e.target.value })
              }
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="tpl-final">Aviso final</Label>
            <Textarea
              id="tpl-final"
              rows={4}
              placeholder="{{razonSocial}}, ultimo aviso..."
              value={templates.final ?? ""}
              onChange={(e) =>
                setTemplates({ ...templates, final: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar configuracion
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
