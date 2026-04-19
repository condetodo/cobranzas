import { getConfig } from "@/lib/config"
import { SettingsForm } from "@/components/settings/settings-form"
import type {
  AgingThresholds,
  SequenceTimeouts,
  SequenceChannels,
  BusinessHours,
} from "@/lib/config"

export default async function SettingsPage() {
  const agingThresholds = await getConfig<AgingThresholds>("aging.thresholds")
  const sequenceTimeouts = await getConfig<SequenceTimeouts>("sequence.timeouts")
  const sequenceChannels = await getConfig<SequenceChannels>("sequence.channels")
  const maxSendFailures = await getConfig<number>("sequence.maxSendFailures")
  const businessHours = await getConfig<BusinessHours>("business.hours")
  const demoFastMode = await getConfig<boolean>("demo.fastMode")
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
          agingThresholds ?? { suave: 15, firme: 30, avisoFinal: 45 }
        }
        sequenceTimeouts={
          sequenceTimeouts ?? {
            softToFirm: 5,
            firmToFinal: 7,
            finalToEscalated: 10,
            inConversation: 3,
          }
        }
        sequenceChannels={
          sequenceChannels ?? { soft: "EMAIL", firm: "EMAIL", final: "EMAIL" }
        }
        maxSendFailures={maxSendFailures ?? 3}
        businessHours={
          businessHours ?? {
            start: "09:00",
            end: "18:00",
            weekdays: [1, 2, 3, 4, 5],
            timezone: "America/Argentina/Buenos_Aires",
          }
        }
        demoFastMode={demoFastMode ?? false}
        contadorEmail={contadorEmail ?? ""}
        whatsappUrl={whatsappUrl ?? ""}
        templates={
          templates ?? { soft: "", firm: "", final: "" }
        }
      />
    </div>
  )
}
