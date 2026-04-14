import { NextRequest, NextResponse } from "next/server"
import { setConfig } from "@/lib/config"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Save each config key
    const keys = Object.keys(body)
    for (const key of keys) {
      await setConfig(key, body[key])
    }

    return NextResponse.json({ ok: true, saved: keys })
  } catch (err: any) {
    console.error('settings error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error saving settings' },
      { status: 500 }
    )
  }
}
