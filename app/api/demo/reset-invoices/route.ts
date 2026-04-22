import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDemoEnabled } from '@/lib/config'
import { auditLog } from '@/lib/audit'

/**
 * Demo-only: borra todas las facturas y datos derivados (secuencias, mensajes,
 * tokens, análisis IA) preservando clientes, configs, usuarios y audit log.
 * Permite cargar distintos Excels de facturas sin tener que resetear a mano.
 *
 * Solo responde si demo.enabled === true en Config.
 */
export async function POST(_req: NextRequest) {
  const enabled = await getDemoEnabled()
  if (!enabled) {
    return NextResponse.json(
      { error: 'Modo demo no está activado' },
      { status: 403 }
    )
  }

  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // demo phase — no blocking
  }

  try {
    const counts = await prisma.$transaction(async (tx) => {
      // Orden respeta las FKs: primero lo que depende de otros.
      const accountantConfirmations = await tx.accountantConfirmation.deleteMany()
      const accountantTokens = await tx.accountantConfirmationToken.deleteMany()
      const incomingMessages = await tx.incomingMessage.deleteMany()
      const outreachAttempts = await tx.outreachAttempt.deleteMany()
      const outreachSequences = await tx.outreachSequence.deleteMany()
      const snapshots = await tx.debtorTriageSnapshot.deleteMany()
      const portfolioAnalyses = await tx.portfolioAnalysis.deleteMany()
      const triageRuns = await tx.triageRun.deleteMany()
      const invoices = await tx.invoice.deleteMany()

      return {
        invoices: invoices.count,
        triageRuns: triageRuns.count,
        portfolioAnalyses: portfolioAnalyses.count,
        snapshots: snapshots.count,
        outreachSequences: outreachSequences.count,
        outreachAttempts: outreachAttempts.count,
        incomingMessages: incomingMessages.count,
        accountantTokens: accountantTokens.count,
        accountantConfirmations: accountantConfirmations.count,
      }
    })

    await auditLog({
      actorType: 'USER',
      actorId: userId,
      action: 'demo.resetInvoices',
      payload: counts,
    })

    return NextResponse.json({ ok: true, counts })
  } catch (err: any) {
    console.error('[demo/reset-invoices] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al resetear datos' },
      { status: 500 }
    )
  }
}
