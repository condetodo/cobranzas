import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/clients/:id/detail — carga el historico completo de un cliente
 * (facturas, secuencias, actividad, confirmaciones del contador) para
 * renderizar el drawer con tabs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { fechaVencimiento: 'asc' },
        },
        outreachSequences: {
          orderBy: { startedAt: 'desc' },
          include: {
            attempts: {
              orderBy: { sentAt: 'desc' },
            },
            incomingMessages: {
              orderBy: { receivedAt: 'desc' },
            },
            confirmationTokens: {
              include: { confirmation: true },
            },
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const invoices = client.invoices.map((inv) => ({
      id: inv.id,
      numero: inv.numero,
      fechaEmision: inv.fechaEmision,
      fechaVencimiento: inv.fechaVencimiento,
      monto: Number(inv.monto),
      paidAmount: inv.paidAmount ? Number(inv.paidAmount) : 0,
      paidAt: inv.paidAt,
      estado: inv.estado,
      moneda: inv.moneda,
    }))

    const sequences = client.outreachSequences.map((seq) => ({
      id: seq.id,
      state: seq.state,
      currentBucket: seq.currentBucket,
      startedAt: seq.startedAt,
      closedAt: seq.closedAt,
      closedReason: seq.closedReason,
      escalationReason: seq.escalationReason,
      attemptCount: seq.attempts.length,
      incomingCount: seq.incomingMessages.length,
    }))

    // Activity: merge outreach attempts, incoming messages, accountant
    // confirmations into a single timeline ordered desc by date.
    type Activity =
      | {
          kind: 'outreach'
          date: Date
          channel: string
          templateCode: string
          body: string
          sequenceId: string
        }
      | {
          kind: 'incoming'
          date: Date
          channel: string
          category: string | null
          body: string
          sequenceId: string
        }
      | {
          kind: 'confirmation'
          date: Date
          decision: string
          amount: number | null
          rejectionReason: string | null
          sequenceId: string
        }

    const activity: Activity[] = []

    for (const seq of client.outreachSequences) {
      for (const a of seq.attempts) {
        const rawBody =
          (a.rawPayload as Record<string, unknown> | null)?.renderedMessage
        activity.push({
          kind: 'outreach',
          date: a.sentAt,
          channel: a.channel,
          templateCode: a.templateCode,
          body: typeof rawBody === 'string' ? rawBody : '',
          sequenceId: seq.id,
        })
      }

      for (const m of seq.incomingMessages) {
        activity.push({
          kind: 'incoming',
          date: m.receivedAt,
          channel: m.channel,
          category: m.classifiedCategory ?? null,
          body: m.text ?? '',
          sequenceId: seq.id,
        })
      }

      for (const t of seq.confirmationTokens) {
        if (t.confirmation) {
          activity.push({
            kind: 'confirmation',
            date: t.confirmation.createdAt,
            decision: t.confirmation.decision,
            amount: t.confirmation.confirmedAmount
              ? Number(t.confirmation.confirmedAmount)
              : null,
            rejectionReason: t.confirmation.rejectionReason ?? null,
            sequenceId: seq.id,
          })
        }
      }
    }

    activity.sort((a, b) => b.date.getTime() - a.date.getTime())

    return NextResponse.json({
      client: {
        id: client.id,
        cod: client.cod,
        razonSocial: client.razonSocial,
        email: client.email,
        telefono: client.telefono,
        telegram: client.telegram,
        categoria: client.categoria,
        autopilotOff: client.autopilotOff,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
      invoices,
      sequences,
      activity,
    })
  } catch (err: any) {
    console.error('[clients.detail] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al cargar el cliente' },
      { status: 500 }
    )
  }
}
