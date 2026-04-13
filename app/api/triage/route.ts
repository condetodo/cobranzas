import { NextRequest, NextResponse } from 'next/server'
import { runTriage } from '@/lib/triage/run-triage'
import { TriageSource } from '@prisma/client'

export async function POST(req: NextRequest) {

  let body: { source?: string; excelFileName?: string } = {}
  try {
    body = await req.json()
  } catch {
    // no body is fine — use defaults
  }

  try {
    const source: TriageSource =
      body.source === 'IMPORT' ? TriageSource.IMPORT : TriageSource.MANUAL

    const result = await runTriage(source, body.excelFileName)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('triage error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error en triage' },
      { status: 500 }
    )
  }
}
