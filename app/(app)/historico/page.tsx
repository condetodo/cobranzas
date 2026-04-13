import { prisma } from "@/lib/db"
import { TriageRunList } from "@/components/historico/triage-run-list"

export default async function HistoricoPage() {
  const runs = await prisma.triageRun.findMany({
    orderBy: { timestamp: "desc" },
  })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historico</h1>
        <p className="text-sm text-muted-foreground">
          Historial de escaneos de triage ejecutados.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-lg text-muted-foreground">
            No hay escaneos registrados aun.
          </p>
        </div>
      ) : (
        <TriageRunList runs={runs} />
      )}
    </div>
  )
}
