import { prisma } from "@/lib/db"
import { DebtorTable } from "@/components/cartera/debtor-table"
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
}

export default async function CarteraPage() {
  // Get latest triage run
  const latestRun = await prisma.triageRun.findFirst({
    orderBy: { timestamp: "desc" },
  })

  if (!latestRun) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Cartera</h1>
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-lg text-muted-foreground">
            No hay datos de cartera aun.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Importa un archivo Excel desde{" "}
            <a href="/analisis-ia" className="text-blue-600 underline">
              Analisis IA
            </a>{" "}
            para empezar.
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

  // Compute display data. Importante: montoTotal e invoiceCount se computan
  // siempre en vivo sobre las facturas PENDING actuales, restando paidAmount
  // para reflejar pagos parciales. El snapshot sirve solo para bucket/score/
  // aiInsight (métricas históricas del último triage).
  const debtors: DebtorRow[] = clients.map((client) => {
    const snap = client.triageSnapshots[0]
    const seq = client.outreachSequences[0]

    const montoTotal = client.invoices.reduce(
      (sum, inv) => sum + Number(inv.monto) - Number(inv.paidAmount ?? 0),
      0
    )

    const now = new Date()
    const diasVencidoMax = Math.max(
      0,
      ...client.invoices.map((inv) =>
        Math.floor(
          (now.getTime() - inv.fechaVencimiento.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
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
      invoiceCount: client.invoices.length,
    }
  })

  // Sort by score descending
  debtors.sort((a, b) => b.score - a.score)

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cartera</h1>
        <p className="text-sm text-muted-foreground">
          {debtors.length} deudores con facturas pendientes
        </p>
      </div>
      <DebtorTable debtors={debtors} />
    </div>
  )
}
