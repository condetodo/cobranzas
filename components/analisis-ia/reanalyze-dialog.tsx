"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Circle, CircleCheck, Loader2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

type PhaseState = "pending" | "active" | "done"

const PHASES = [
  {
    label: "Clasificando deudores",
    description: "Calculando días vencidos, score y segmento por cliente.",
    estimatedMs: 3000,
  },
  {
    label: "Generando insights personalizados",
    description: "Agent A analiza cada deudor prioritario.",
    estimatedMs: 30000,
  },
  {
    label: "Analizando portfolio completo",
    description: "Agent B detecta hallazgos y arma plan de acción.",
    estimatedMs: 15000,
  },
]

interface ReanalyzeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal de progreso para /api/triage. Muestra 3 fases con timers estimados
 * (fake progress) en paralelo al fetch real. Al terminar el fetch, fuerza
 * todas las fases a "done" y habilita el cierre. Pensado para que la espera
 * de 30-60s no se sienta muerta.
 */
export function ReanalyzeDialog({ open, onOpenChange }: ReanalyzeDialogProps) {
  const [phaseStates, setPhaseStates] = useState<PhaseState[]>([
    "pending",
    "pending",
    "pending",
  ])
  const [completed, setCompleted] = useState(false)
  const [errored, setErrored] = useState(false)
  const router = useRouter()
  const hasStarted = useRef(false)

  useEffect(() => {
    if (!open) {
      setPhaseStates(["pending", "pending", "pending"])
      setCompleted(false)
      setErrored(false)
      hasStarted.current = false
      return
    }
    if (hasStarted.current) return
    hasStarted.current = true

    const timers: ReturnType<typeof setTimeout>[] = []

    setPhaseStates(["active", "pending", "pending"])

    timers.push(
      setTimeout(() => {
        setPhaseStates((prev) =>
          prev[0] === "done" ? prev : ["done", "active", "pending"]
        )
      }, PHASES[0].estimatedMs)
    )

    timers.push(
      setTimeout(() => {
        setPhaseStates((prev) =>
          prev[1] === "done" ? prev : ["done", "done", "active"]
        )
      }, PHASES[0].estimatedMs + PHASES[1].estimatedMs)
    )

    fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "MANUAL" }),
    })
      .then((res) => {
        if (!res.ok) {
          setErrored(true)
          return
        }
        setPhaseStates(["done", "done", "done"])
        setCompleted(true)
        router.refresh()
      })
      .catch(() => {
        setErrored(true)
      })

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [open, router])

  const canClose = completed || errored

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (canClose) onOpenChange(v)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          if (!canClose) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Analizando tu cartera
          </DialogTitle>
          <DialogDescription>
            Los agentes IA están revisando tus deudores y armando el plan de
            acción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {PHASES.map((phase, i) => {
            const state = phaseStates[i]
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {state === "done" ? (
                    <CircleCheck className="h-5 w-5 text-green-600" />
                  ) : state === "active" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={
                      state === "pending"
                        ? "text-sm text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {phase.label}
                  </p>
                  {state === "active" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {phase.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {errored && (
          <p className="text-sm text-red-600">
            Ocurrió un error al analizar. Cerrá e intentá de nuevo.
          </p>
        )}

        {canClose && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              {errored ? "Cerrar" : "Listo"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
