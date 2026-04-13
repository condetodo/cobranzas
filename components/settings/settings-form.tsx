"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ExcelDropzone } from "@/components/import/excel-dropzone"
import { Loader2, Save, CheckCircle2, Wifi } from "lucide-react"
import type { AgingThresholds, SequenceTimeouts } from "@/lib/config"

interface SettingsFormProps {
  agingThresholds: AgingThresholds
  sequenceTimeouts: SequenceTimeouts
  contadorEmail: string
  whatsappUrl: string
  templates: Record<string, string>
}

export function SettingsForm({
  agingThresholds: initialAging,
  sequenceTimeouts: initialTimeouts,
  contadorEmail: initialEmail,
  whatsappUrl: initialWhatsapp,
  templates: initialTemplates,
}: SettingsFormProps) {
  const [aging, setAging] = useState(initialAging)
  const [timeouts, setTimeouts] = useState(initialTimeouts)
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
      {/* Import section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar datos</CardTitle>
        </CardHeader>
        <CardContent>
          <ExcelDropzone />
        </CardContent>
      </Card>

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
            Timeouts de secuencias (segundos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
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
