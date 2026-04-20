"use client"

import { useMemo, useState } from "react"
import type { ClientRow } from "@/app/(app)/clientes/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatARS } from "@/lib/format"
import { PauseCircle, Search, UserPlus } from "lucide-react"
import { ClientDrawer } from "./client-drawer"
import { NewClientDialog } from "./new-client-dialog"

export function ClientsTable({ initialRows }: { initialRows: ClientRow[] }) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (c) =>
        c.razonSocial.toLowerCase().includes(term) ||
        c.cod.toLowerCase().includes(term) ||
        (c.email?.toLowerCase().includes(term) ?? false)
    )
  }, [initialRows, search])

  const selectedRow = initialRows.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {initialRows.length} clientes registrados
          </p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por razon social, codigo o email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Codigo</TableHead>
              <TableHead>Razon Social</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Pendientes</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-[50px] text-center">AP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  {initialRows.length === 0
                    ? "No hay clientes todavia. Importa un Excel desde Cartera o crea uno con 'Nuevo cliente'."
                    : "No se encontraron clientes con esa busqueda."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(c.id)}
                >
                  <TableCell className="tabular-nums text-xs">{c.cod}</TableCell>
                  <TableCell className="font-medium">{c.razonSocial}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.telefono ?? "-"}
                  </TableCell>
                  <TableCell>
                    {c.categoria ? (
                      <Badge variant="outline">{c.categoria}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.invoicesPending > 0 ? (
                      <span className="font-medium">{c.invoicesPending}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-1">
                      / {c.invoicesTotal}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.saldoPendiente > 0 ? (
                      formatARS(c.saldoPendiente)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.autopilotOff && (
                      <PauseCircle className="h-4 w-4 text-amber-500 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ClientDrawer
        summary={selectedRow}
        onClose={() => setSelectedId(null)}
      />

      <NewClientDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  )
}
