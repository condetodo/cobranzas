import { getConfig } from "@/lib/config"
import { SettingsForm } from "@/components/settings/settings-form"
import type { AgingThresholds, SequenceTimeouts } from "@/lib/config"

export default async function SettingsPage() {
  const agingThresholds = await getConfig<AgingThresholds>("aging.thresholds")
  const sequenceTimeouts = await getConfig<SequenceTimeouts>("sequence.timeouts")
  const contadorEmail = await getConfig<string>("contador.email")
  const whatsappUrl = await getConfig<string>("whatsapp.demo.url")
  const templates = await getConfig<Record<string, string>>("templates.copy")

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configuracion del sistema de cobranzas.
        </p>
      </div>

      <SettingsForm
        agingThresholds={
          agingThresholds ?? { suave: 30, firme: 60, avisoFinal: 90 }
        }
        sequenceTimeouts={
          sequenceTimeouts ?? {
            softToFirm: 259200,
            firmToFinal: 259200,
            finalToEscalated: 172800,
          }
        }
        contadorEmail={contadorEmail ?? ""}
        whatsappUrl={whatsappUrl ?? ""}
        templates={
          templates ?? { soft: "", firm: "", final: "" }
        }
      />
    </div>
  )
}
