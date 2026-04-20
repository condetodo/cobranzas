import { prisma } from "@/lib/db"
import { DebtorTable } from "@/components/cartera/debtor-table"
import { CarteraActions } from "@/components/cartera/cartera-actions"
import type { Bucket, SequenceState } from "@prisma/client"

// Force every request to read fresh data from the DB. Sin esto Next cachea la
// página y acciones recientes (confirmación de pago parcial, cambio de estado
// de secuencia, etc.) no se ven hasta un hard refresh.
export const dynamic = "force-dynamic"

export interface DebtorRow {
  id: string
  cod: string
  razonSocial: string
  email: string | null
  telefono: string | null
  montoTotal: number
  diasVencidoMax: number
  bucket: Bucket
  score: number
  sequenceState: SequenceState | null
  aiInsight: string | null
  autopilotOff: boolean
  invoiceCount: number
  invoices: DebtorInvoice[]
}

export interface DebtorInvoice {
  id: string
  numero: string
  fechaVencimiento: Date
  monto: number
  paidAmount: number
  saldo: number
  diasVencido: number
}

export default async function CarteraPage() {
  // Get latest triage run
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: "desc" },
  })

  if (!latestRun) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cartera</h1>
            <p className="text-sm text-muted-foreground">
              Importa tus datos para empezar a cobrar.
            </p>
          </div>
          <CarteraActions />
        </div>
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-lg text-muted-foreground">
            No hay datos de cartera aun.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Usa el boton &quot;Importar Excel&quot; arriba para empezar.
          </p>
        </div>
      </div>
    )
  }

  // Query clients with PENDING invoices, their sequences, and triage snapshots
  const clients = await prisma.client.findMany({
    where: {
      invoices: {
        some: { estado: "PENDING" },
      },
    },
    include: {
      invoices: { where: { estado: "PENDING" } },
      outreachSequences: {
        where: { closedAt: null },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
      triageSnapshots: {
        where: { triageRunId: latestRun.id },
        take: 1,
      },
    },
  })

  // Compute display data. Importante: montoTotal, invoiceCount e invoices se
  // computan siempre en vivo sobre las facturas PENDING actuales, restando
  // paidAmount para reflejar pagos parciales. El snapshot sirve solo para
  // bucket/score/aiInsight (métricas históricas del último triage).
  const now = new Date()
  const debtors: DebtorRow[] = clients.map((client) => {
    const snap = client.triageSnapshots[0]
    const seq = client.outreachSequences[0]

    const invoices: DebtorInvoice[] = client.invoices
      .map((inv) => {
        const monto = Number(inv.monto)
        const paidAmount = Number(inv.paidAmount ?? 0)
        const diasVencido = Math.floor(
          (now.getTime() - inv.fechaVencimiento.getTime()) /
            (1000 * 60 * 60 * 24)
        )
        return {
          id: inv.id,
          numero: inv.numero,
          fechaVencimiento: inv.fechaVencimiento,
          monto,
          paidAmount,
          saldo: monto - paidAmount,
          diasVencido,
        }
      })
      // Factura más vieja primero
      .sort(
        (a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime()
      )

    const montoTotal = invoices.reduce((sum, inv) => sum + inv.saldo, 0)
    const diasVencidoMax = invoices.reduce(
      (max, inv) => Math.max(max, inv.diasVencido),
      0
    )

    return {
      id: client.id,
      cod: client.cod,
      razonSocial: client.razonSocial,
      email: client.email,
      telefono: client.telefono,
      montoTotal,
      diasVencidoMax,
      bucket: snap?.bucket ?? "SUAVE",
      score: snap?.score ?? 0,
      sequenceState: seq?.state ?? null,
      aiInsight: snap?.aiInsight ?? null,
      autopilotOff: client.autopilotOff,
      invoiceCount: invoices.length,
      invoices,
    }
  })

  // Sort: score desc → diasVencidoMax desc → montoTotal desc.
  // Score viene del snapshot y empata en 0 cuando no hay triage reciente;
  // los fallbacks aseguran un orden útil (priorizar mora y monto) cuando eso pasa.
  debtors.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.diasVencidoMax !== a.diasVencidoMax)
      return b.diasVencidoMax - a.diasVencidoMax
    return b.montoTotal - a.montoTotal
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cartera</h1>
          <p className="text-sm text-muted-foreground">
            {debtors.length} deudores con facturas pendientes
          </p>
        </div>
        <CarteraActions />
      </div>
      <DebtorTable debtors={debtors} />
    </div>
  )
}
