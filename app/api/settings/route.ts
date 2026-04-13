import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { setConfig } from "@/lib/config"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  // Save each config key
  const keys = Object.keys(body)
  for (const key of keys) {
    await setConfig(key, body[key])
  }

  return NextResponse.json({ ok: true, saved: keys })
}
