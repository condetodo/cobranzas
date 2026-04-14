import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { importExcel } from '@/lib/excel/import'

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

    const result = await importExcel(
      clientsBuffer,
      invoicesBuffer,
      userId,
      clientsFile?.name ?? invoicesFile?.name
    )
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('import error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error al importar' },
      { status: 500 }
    )
  }
}
