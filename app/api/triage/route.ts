import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runTriage } from '@/lib/triage/run-triage'
import { TriageSource } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { source?: string; excelFileName?: string } = {}
  try {
    body = await req.json()
  } catch {
    // no body is fine — use defaults
  }

  const source: TriageSource =
    body.source === 'IMPORT' ? TriageSource.IMPORT : TriageSource.MANUAL

  const result = await runTriage(source, body.excelFileName)
  return NextResponse.json(result)
}
