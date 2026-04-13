"use client"

import { useCallback, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  Check,
} from "lucide-react"
import { useRouter } from "next/navigation"

type StepStatus = "pending" | "running" | "done"

interface ProgressStep {
  label: string
  status: StepStatus
  detail?: string
}

export function ExcelDropzone() {
  const [files, setFiles] = useState<{ clientes?: File; facturas?: File }>({})
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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
        // If we don't have clientes yet, assign first file as clientes, otherwise facturas
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

  async function handleImport() {
    if (!files.clientes && !files.facturas) return

    setImporting(true)
    setError(null)

    // Initialize progress steps
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
      currentSteps = updateStep(
        0,
        {
          status: "done",
          detail: `${importData.invoicesCreated ?? "?"} facturas importadas`,
        },
        currentSteps
      )

      // Step 2-4: Triage (runs all analysis)
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

      // Simulate slight delay for WOW effect
      await new Promise((r) => setTimeout(r, 500))
      currentSteps = updateStep(
        2,
        { status: "done", detail: "Insights generados" },
        currentSteps
      )
      currentSteps = updateStep(3, { status: "running" }, currentSteps)

      await new Promise((r) => setTimeout(r, 500))

      if (!triageRes.ok) {
        throw new Error("Error en el analisis de triage")
      }

      const triageData = await triageRes.json()
      currentSteps = updateStep(
        3,
        {
          status: "done",
          detail: `${triageData.totalDebtors ?? "?"} deudores analizados`,
        },
        currentSteps
      )

      // Done - refresh to show results
      await new Promise((r) => setTimeout(r, 800))
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Error inesperado")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        {!importing && steps.length === 0 && (
          <>
            {/* Dropzone */}
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
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
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Arrastra archivos Excel aqui o haz click para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                clientes.xlsx y facturas.xlsx
              </p>
            </div>

            {/* File list */}
            {(files.clientes || files.facturas) && (
              <div className="mt-4 space-y-2">
                {files.clientes && (
                  <FileItem
                    name={files.clientes.name}
                    size={files.clientes.size}
                    onRemove={() => removeFile("clientes")}
                  />
                )}
                {files.facturas && (
                  <FileItem
                    name={files.facturas.name}
                    size={files.facturas.size}
                    onRemove={() => removeFile("facturas")}
                  />
                )}
                <Button
                  className="w-full mt-3"
                  onClick={handleImport}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar y analizar
                </Button>
              </div>
            )}
          </>
        )}

        {/* Progress display */}
        {(importing || steps.length > 0) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm mb-4">
              Procesando datos...
            </h3>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  {step.status === "done" && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                  {step.status === "running" && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  )}
                  {step.status === "pending" && (
                    <div className="h-2 w-2 rounded-full bg-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-mono ${
                      step.status === "done"
                        ? "text-green-700"
                        : step.status === "running"
                        ? "text-blue-700"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                    {step.status === "running" && (
                      <span className="animate-pulse">...</span>
                    )}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FileItem({
  name,
  size,
  onRemove,
}: {
  name: string
  size: number
  onRemove: () => void
}) {
  const sizeKB = (size / 1024).toFixed(1)
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <FileSpreadsheet className="h-5 w-5 text-green-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{sizeKB} KB</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="rounded-sm p-1 hover:bg-gray-100"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
