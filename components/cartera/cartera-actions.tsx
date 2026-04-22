"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExcelDropzone } from "@/components/import/excel-dropzone"
import { ReanalyzeDialog } from "@/components/analisis-ia/reanalyze-dialog"
import { Upload, Loader2, Bot, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface CarteraActionsProps {
  demoEnabled: boolean
}

export function CarteraActions({ demoEnabled }: CarteraActionsProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState("")
  const [resetting, setResetting] = useState(false)
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false)
  const router = useRouter()

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch("/api/demo/reset-invoices", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`Error: ${data?.error ?? "no se pudo resetear"}`)
        return
      }
      setResetOpen(false)
      setResetConfirmText("")
      router.refresh()
      const n = data?.counts?.invoices ?? 0
      alert(`Reset completo. ${n} facturas borradas.`)
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "fallo la conexion"}`)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {demoEnabled && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setResetOpen(true)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Reset demo
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setReanalyzeOpen(true)}
      >
        <Bot className="h-4 w-4 mr-1" />
        Reanalizar con IA
      </Button>

      <ReanalyzeDialog
        open={reanalyzeOpen}
        onOpenChange={setReanalyzeOpen}
      />

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
          <ExcelDropzone onComplete={() => setImportOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (!resetting) {
            setResetOpen(open)
            if (!open) setResetConfirmText("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Reset demo</DialogTitle>
            <DialogDescription>
              Esto borra <strong>todas las facturas</strong>, secuencias, mensajes,
              confirmaciones del contador y análisis IA. Los clientes y las
              configuraciones se mantienen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">
              Escribí <code className="font-semibold">BORRAR</code> para confirmar
            </Label>
            <Input
              id="reset-confirm"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="BORRAR"
              autoComplete="off"
              disabled={resetting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetOpen(false)
                setResetConfirmText("")
              }}
              disabled={resetting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetConfirmText !== "BORRAR" || resetting}
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Borrando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Borrar todo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
