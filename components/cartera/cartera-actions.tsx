"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ExcelDropzone } from "@/components/import/excel-dropzone"
import { Upload, Loader2, Bot } from "lucide-react"
import { useRouter } from "next/navigation"

export function CarteraActions() {
  const [importOpen, setImportOpen] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const router = useRouter()

  async function handleReanalyze() {
    setReanalyzing(true)
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "MANUAL" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Error: ${data?.error ?? "no se pudo reanalizar"}`)
        return
      }
      router.refresh()
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "fallo la conexion"}`)
    } finally {
      setReanalyzing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleReanalyze}
        disabled={reanalyzing}
      >
        {reanalyzing ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Bot className="h-4 w-4 mr-1" />
        )}
        {reanalyzing ? "Analizando..." : "Reanalizar con IA"}
      </Button>

      <Button size="sm" onClick={() => setImportOpen(true)}>
        <Upload className="h-4 w-4 mr-1" />
        Importar Excel
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar datos</DialogTitle>
            <DialogDescription>
              Subi tu archivo de clientes, facturas, o ambos. El sistema va a
              identificarlos por el nombre del archivo (clientes.xlsx / facturas.xlsx).
              Al terminar, un analisis IA se dispara automaticamente.
            </DialogDescription>
          </DialogHeader>
          <ExcelDropzone />
        </DialogContent>
      </Dialog>
    </div>
  )
}
