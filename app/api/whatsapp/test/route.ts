import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const url = body.url as string

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 })
  }

  try {
    // Try to reach the WhatsApp API endpoint
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ ok: true, status: res.status })
  } catch {
    return NextResponse.json(
      { error: "Connection failed" },
      { status: 502 }
    )
  }
}
