"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, UserPlus } from "lucide-react"

export function NewClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    cod: "",
    razonSocial: "",
    email: "",
    telefono: "",
    telegram: "",
    categoria: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setForm({
      cod: "",
      razonSocial: "",
      email: "",
      telefono: "",
      telegram: "",
      categoria: "",
    })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.cod.trim() || !form.razonSocial.trim()) {
      setError("Codigo y razon social son obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? "No se pudo crear el cliente")
        return
      }
      reset()
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "Error de conexion")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Completa los datos basicos. Podes editarlos despues desde la tabla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc-cod">Codigo *</Label>
              <Input
                id="nc-cod"
                value={form.cod}
                onChange={(e) => setForm({ ...form, cod: e.target.value })}
                placeholder="Ej: 23"
                className="tabular-nums"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-cat">Categoria</Label>
              <Input
                id="nc-cat"
                value={form.categoria}
                onChange={(e) =>
                  setForm({ ...form, categoria: e.target.value })
                }
                placeholder="A / B / C"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-rs">Razon Social *</Label>
            <Input
              id="nc-rs"
              value={form.razonSocial}
              onChange={(e) =>
                setForm({ ...form, razonSocial: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc-email">Email</Label>
              <Input
                id="nc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-tel">Telefono</Label>
              <Input
                id="nc-tel"
                value={form.telefono}
                onChange={(e) =>
                  setForm({ ...form, telefono: e.target.value })
                }
                placeholder="+54911..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-tg">Telegram</Label>
            <Input
              id="nc-tg"
              value={form.telegram}
              onChange={(e) => setForm({ ...form, telegram: e.target.value })}
              placeholder="@usuario"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Crear cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
