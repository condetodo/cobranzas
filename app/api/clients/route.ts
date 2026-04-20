import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'

interface CreateClientBody {
  cod: string
  razonSocial: string
  email?: string | null
  telefono?: string | null
  telegram?: string | null
  categoria?: string | null
}

/**
 * POST /api/clients — crea un cliente manualmente desde la UI.
 */
export async function POST(req: NextRequest) {
  let userId = 'system'
  try {
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
  } catch {
    // demo phase — no blocking
  }

  let body: CreateClientBody
  try {
    body = (await req.json()) as CreateClientBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const cod = String(body.cod ?? '').trim()
  const razonSocial = String(body.razonSocial ?? '').trim()

  if (!cod) {
    return NextResponse.json({ error: 'El codigo es obligatorio' }, { status: 400 })
  }
  if (!razonSocial) {
    return NextResponse.json(
      { error: 'La razon social es obligatoria' },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.client.findUnique({ where: { cod } })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un cliente con codigo "${cod}"` },
        { status: 409 }
      )
    }

    const client = await prisma.client.create({
      data: {
        cod,
        razonSocial,
        email: body.email?.trim() || null,
        telefono: body.telefono?.trim() || null,
        telegram: body.telegram?.trim() || null,
        categoria: body.categoria?.trim() || null,
      },
    })

    await auditLog({
      actorType: 'USER',
      actorId: userId,
      action: 'client.created',
      targetType: 'Client',
      targetId: client.id,
      payload: { cod: client.cod, razonSocial: client.razonSocial, source: 'manual' },
    })

    return NextResponse.json({ ok: true, client })
  } catch (err: any) {
    console.error('[clients.POST] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al crear el cliente' },
      { status: 500 }
    )
  }
}
