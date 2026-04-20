import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'

interface UpdateClientBody {
  razonSocial?: string
  email?: string | null
  telefono?: string | null
  telegram?: string | null
  categoria?: string | null
  autopilotOff?: boolean
}

/**
 * PATCH /api/clients/:id — actualiza datos editables del cliente.
 * El `cod` NO es editable porque es la clave con la que se matchea al
 * re-importar el Excel; cambiarlo crearia un cliente duplicado.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // demo phase
  }

  let body: UpdateClientBody
  try {
    body = (await req.json()) as UpdateClientBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.razonSocial === 'string') {
      const v = body.razonSocial.trim()
      if (!v) {
        return NextResponse.json(
          { error: 'La razon social no puede estar vacia' },
          { status: 400 }
        )
      }
      data.razonSocial = v
    }
    if ('email' in body) data.email = body.email?.trim() || null
    if ('telefono' in body) data.telefono = body.telefono?.trim() || null
    if ('telegram' in body) data.telegram = body.telegram?.trim() || null
    if ('categoria' in body) data.categoria = body.categoria?.trim() || null
    if (typeof body.autopilotOff === 'boolean') data.autopilotOff = body.autopilotOff

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, client: existing })
    }

    const client = await prisma.client.update({ where: { id }, data })

    await auditLog({
      actorType: 'USER',
      actorId: userId,
      action: 'client.updated',
      targetType: 'Client',
      targetId: id,
      payload: { cod: client.cod, changed: Object.keys(data) },
    })

    return NextResponse.json({ ok: true, client })
  } catch (err: any) {
    console.error('[clients.PATCH] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al actualizar el cliente' },
      { status: 500 }
    )
  }
}
