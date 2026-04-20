import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transitionSequence } from '@/lib/state-machine/transitions'
import { auditLog } from '@/lib/audit'

/**
 * Marca una factura como PAID manualmente (cierre "cruzado con archivo contable").
 * Si era la última PENDING del cliente, auto-cierra la secuencia activa.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params

  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // demo phase — no blocking
  }

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    if (invoice.estado !== 'PENDING') {
      return NextResponse.json(
        { error: `La factura ya está ${invoice.estado}` },
        { status: 400 }
      )
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        estado: 'PAID',
        paidAt: new Date(),
        paidAmount: invoice.monto,
      },
    })

    // Si esta era la última PENDING del cliente, cerramos su secuencia activa
    // para que el runner deje de mandar mensajes.
    const remainingPending = await prisma.invoice.count({
      where: { clientId: invoice.clientId, estado: 'PENDING' },
    })

    let sequenceClosed = false
    if (remainingPending === 0) {
      const activeSeq = await prisma.outreachSequence.findFirst({
        where: { clientId: invoice.clientId, closedAt: null },
      })
      if (activeSeq) {
        try {
          await transitionSequence(activeSeq.id, 'PAID', {
            closedReason: 'MANUAL_OVERRIDE',
            actorType: 'USER',
            actorId: userId,
          })
          sequenceClosed = true
        } catch (err) {
          console.error(
            `[mark-paid] no pude cerrar la secuencia del cliente ${invoice.clientId}:`,
            err
          )
        }
      }
    }

    await auditLog({
      actorType: 'USER',
      actorId: userId,
      action: 'invoice.markedPaid',
      targetType: 'Invoice',
      targetId: invoiceId,
      payload: {
        clientId: invoice.clientId,
        numero: invoice.numero,
        monto: Number(invoice.monto),
        source: 'manual',
        sequenceClosed,
        remainingPending,
      },
    })

    return NextResponse.json({ ok: true, sequenceClosed, remainingPending })
  } catch (err: any) {
    console.error('[mark-paid] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al marcar la factura como pagada' },
      { status: 500 }
    )
  }
}
