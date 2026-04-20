import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { importExcel } from '@/lib/excel/import'
import { runTriage } from '@/lib/triage/run-triage'
import { TriageSource } from '@prisma/client'

export async function POST(req: NextRequest) {
  // Try to get session, but don't block on it (demo phase)
  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // ignore auth errors in demo
  }

  const formData = await req.formData()
  const clientsFile = formData.get('clientes') as File | null
  const invoicesFile = formData.get('facturas') as File | null

  if (!clientsFile && !invoicesFile) {
    return NextResponse.json({ error: 'At least one file required' }, { status: 400 })
  }

  try {
    const clientsBuffer = clientsFile ? Buffer.from(await clientsFile.arrayBuffer()) : null
    const invoicesBuffer = invoicesFile ? Buffer.from(await invoicesFile.arrayBuffer()) : null

    const fileName = clientsFile?.name ?? invoicesFile?.name
    const result = await importExcel(
      clientsBuffer,
      invoicesBuffer,
      userId,
      fileName
    )

    // Auto-triage en background si hubo cambios relevantes. Fire-and-forget
    // para no bloquear la respuesta del import (el triage toma 30-60s por los
    // LLM calls). El usuario entra a /cartera y ve los buckets/scores
    // actualizados cuando el background termina; `dynamic = 'force-dynamic'`
    // en la page evita caché stale.
    const changedInvoices =
      result.invoices.created + result.invoices.updated + result.invoices.closed
    const triageTriggered = changedInvoices > 0
    if (triageTriggered) {
      void runTriage(TriageSource.IMPORT, fileName).catch((err) => {
        console.error('[import] background triage failed:', err)
      })
    }

    return NextResponse.json({ ...result, triageTriggered })
  } catch (err: any) {
    console.error('import error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error al importar' },
      { status: 500 }
    )
  }
}
