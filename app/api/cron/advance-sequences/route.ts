import { NextResponse } from 'next/server'
import { advanceSequences } from '@/lib/state-machine/runner'

export async function GET() {
  const result = await advanceSequences()
  return NextResponse.json(result)
}
