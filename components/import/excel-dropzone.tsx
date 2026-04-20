"use client"

import { useCallback, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  Check,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { useRouter } from "next/navigation"

type StepStatus = "pending" | "running" | "done"

interface ProgressStep {
  label: string
  status: StepStatus
  detail?: string
}

interface ImportSummary {
  clientsCreated: number
  clientsUpdated: number
  invoicesCreated: number
  invoicesUpdated: number
  totalDebtors: number
}

export function ExcelDropzone({
  onComplete,
}: {
  onComplete?: () => void
}) {
  const [files, setFiles] = useState<{ clientes?: File; facturas?: File }>({})
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const allDone = steps.length > 0 && steps.every((s) => s.status === "done")

  function handleFiles(fileList: FileList) {
    const newFiles = { ...files }
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i]
      const name = f.name.toLowerCase()
      if (name.includes("cliente")) {
        newFiles.clientes = f
      } else if (name.includes("factura")) {
        newFiles.facturas = f
      } else {
        if (!newFiles.clientes) newFiles.clientes = f
        else newFiles.facturas = f
      }
    }
    setFiles(newFiles)
    setError(null)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [files]
  )

  function removeFile(key: "clientes" | "facturas") {
    setFiles((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function updateStep(
    idx: number,
    update: Partial<ProgressStep>,
    current: ProgressStep[]
  ) {
    const next = [...current]
    next[idx] = { ...next[idx], ...update }
    setSteps(next)
    return next
  }

  function resetToStart() {
    setFiles({})
    setSteps([])
    setError(null)
    setSummary(null)
    setImporting(false)
  }

  async function handleImport() {
    if (!files.clientes && !files.facturas) return

    setImporting(true)
    setError(null)
    setSummary(null)

    let currentSteps: ProgressStep[] = [
      { label: "Importando datos", status: "running" },
      { label: "Calculando prioridades", status: "pending" },
      { label: "Generando insights con IA", status: "pending" },
      { label: "Analisis portfolio-wide", status: "pending" },
    ]
    setSteps(currentSteps)

    try {
      // Step 1: Import
      const formData = new FormData()
      if (files.clientes) formData.append("clientes", files.clientes)
      if (files.facturas) formData.append("facturas", files.facturas)

      const importRes = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      if (!importRes.ok) {
        throw new Error("Error al importar archivos")
      }

      const importData = await importRes.json()
      const invoicesNew = importData?.invoices?.created ?? 0
      const invoicesUpd = importData?.invoices?.updated ?? 0
      const clientsNew = importData?.clients?.created ?? 0
      const clientsUpd = importData?.clients?.updated ?? 0

      currentSteps = updateStep(
        0,
        {
          status: "done",
          detail: `${invoicesNew} nuevas, ${invoicesUpd} actualizadas`,
        },
        currentSteps
      )

      // Step 2-4: Triage
      currentSteps = updateStep(1, { status: "running" }, currentSteps)

      const triageRes = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "IMPORT",
          excelFileName: files.clientes?.name ?? files.facturas?.name,
        }),
      })

      currentSteps = updateStep(
        1,
        { status: "done", detail: "Prioridades calculadas" },
        currentSteps
      )
      currentSteps = updateStep(2, { status: "running" }, currentSteps)

      await new Promise((r) => setTimeout(r, 400))
      currentSteps = updateStep(
        2,
        { status: "done", detail: "Insights generados" },
        currentSteps
      )
      currentSteps = updateStep(3, { status: "running" }, currentSteps)

      await new Promise((r) => setTimeout(r, 400))

      if (!triageRes.ok) {
        throw new Error("Error en el analisis de triage")
      }

      const triageData = await triageRes.json()
      const totalDebtors = triageData?.totalDebtors ?? 0

      currentSteps = updateStep(
        3,
        {
          status: "done",
          detail: `${totalDebtors} deudores analizados`,
        },
        currentSteps
      )

      setSummary({
        clientsCreated: clientsNew,
        clientsUpdated: clientsUpd,
        invoicesCreated: invoicesNew,
        invoicesUpdated: invoicesUpd,
        totalDebtors,
      })

      // Refresh underlying page so data is fresh when user closes
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Error inesperado")
    } finally {
      setImporting(false)
    }
  }

  // ── DONE state ─────────────────────────────────────────────────────────
  if (allDone && summary) {
    return (
      <div className="py-4">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Import completado</h3>
            <p className="text-sm text-muted-foreground">
              Los datos están listos en tu cartera.
            </p>
          </div>

          <div className="w-full rounded-lg border bg-gray-50 p-4 space-y-2 text-left">
            <SummaryRow
              label="Clientes"
              value={
                summary.clientsCreated + summary.clientsUpdated > 0
                  ? `${summary.clientsCreated} nuevos · ${summary.clientsUpdated} actualizados`
                  : "Sin cambios"
              }
            />
            <SummaryRow
              label="Facturas"
              value={
                summary.invoicesCreated + summary.invoicesUpdated > 0
                  ? `${summary.invoicesCreated} nuevas · ${summary.invoicesUpdated} actualizadas`
                  : "Sin cambios"
              }
            />
            <SummaryRow
              label="Analisis IA"
              value={`${summary.totalDebtors} deudores analizados`}
            />
          </div>

          <div className="flex w-full justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={resetToStart}>
              Importar otro
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetToStart()
                onComplete?.()
              }}
            >
              Terminado
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── PROGRESS state ─────────────────────────────────────────────────────
  if (importing || steps.length > 0) {
    return (
      <div className="py-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Procesando datos</h3>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar 30-60 segundos segun el volumen.
          </p>
        </div>

        <ol className="relative space-y-4 pl-2">
          {steps.map((step, i) => (
            <li key={i} className="relative flex gap-3">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <span
                  className={`absolute left-[11px] top-6 h-[calc(100%-8px)] w-px ${
                    step.status === "done" ? "bg-green-300" : "bg-gray-200"
                  }`}
                  aria-hidden
                />
              )}
              <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                {step.status === "done" ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </div>
                ) : step.status === "running" ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                )}
              </div>
              <div className="flex-1 pt-0.5">
                <p
                  className={`text-sm font-medium ${
                    step.status === "done"
                      ? "text-gray-700"
                      : step.status === "running"
                      ? "text-blue-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                  {step.status === "running" && (
                    <span className="ml-1 animate-pulse text-blue-500">...</span>
                  )}
                </p>
                {step.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">No se pudo completar el import</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={resetToStart}>
              Volver a intentar
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── IDLE / SELECTING state ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div
        className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-blue-500 bg-blue-50/60"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Arrastra tus archivos Excel aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              o click para seleccionar · admite <code className="rounded bg-gray-100 px-1">clientes.xlsx</code> y <code className="rounded bg-gray-100 px-1">facturas.xlsx</code>
            </p>
          </div>
        </div>
      </div>

      {(files.clientes || files.facturas) && (
        <div className="space-y-2">
          {files.clientes && (
            <FileItem
              label="Clientes"
              name={files.clientes.name}
              size={files.clientes.size}
              onRemove={() => removeFile("clientes")}
            />
          )}
          {files.facturas && (
            <FileItem
              label="Facturas"
              name={files.facturas.name}
              size={files.facturas.size}
              onRemove={() => removeFile("facturas")}
            />
          )}
          <Button className="w-full mt-2" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Importar y analizar
          </Button>
        </div>
      )}
    </div>
  )
}

function FileItem({
  label,
  name,
  size,
  onRemove,
}: {
  label: string
  name: string
  size: number
  onRemove: () => void
}) {
  const sizeKB = (size / 1024).toFixed(1)
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-50">
        <FileSpreadsheet className="h-4 w-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{sizeKB} KB</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-900"
        aria-label="Quitar archivo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  )
}
