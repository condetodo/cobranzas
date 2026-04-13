import { NextResponse } from 'next/server'
import { advanceSequences } from '@/lib/state-machine/runner'

export async function GET() {
  try {
    const result = await advanceSequences()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('advance-sequences error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error advancing sequences' },
      { status: 500 }
    )
  }
}
