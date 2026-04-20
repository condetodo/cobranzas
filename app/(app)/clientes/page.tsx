import { prisma } from "@/lib/db"
import { ClientsTable } from "@/components/clientes/clients-table"

export const dynamic = "force-dynamic"

export interface ClientRow {
  id: string
  cod: string
  razonSocial: string
  email: string | null
  telefono: string | null
  telegram: string | null
  categoria: string | null
  autopilotOff: boolean
  invoicesPending: number
  invoicesTotal: number
  saldoPendiente: number
  hasActiveSequence: boolean
}

export default async function ClientesPage() {
  const clients = await prisma.client.findMany({
    orderBy: { razonSocial: "asc" },
    include: {
      invoices: {
        select: { estado: true, monto: true, paidAmount: true },
      },
      outreachSequences: {
        where: { closedAt: null },
        select: { id: true },
      },
    },
  })

  const rows: ClientRow[] = clients.map((client) => {
    const pending = client.invoices.filter((i) => i.estado === "PENDING")
    const saldoPendiente = pending.reduce(
      (sum, inv) => sum + Number(inv.monto) - Number(inv.paidAmount ?? 0),
      0
    )
    return {
      id: client.id,
      cod: client.cod,
      razonSocial: client.razonSocial,
      email: client.email,
      telefono: client.telefono,
      telegram: client.telegram,
      categoria: client.categoria,
      autopilotOff: client.autopilotOff,
      invoicesPending: pending.length,
      invoicesTotal: client.invoices.length,
      saldoPendiente,
      hasActiveSequence: client.outreachSequences.length > 0,
    }
  })

  return (
    <div className="p-6 space-y-4">
      <ClientsTable initialRows={rows} />
    </div>
  )
}
