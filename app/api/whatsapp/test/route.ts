import { NextRequest, NextResponse } from 'next/server'

/**
 * Hits Evolution API's `GET {url}/instance/connectionState/{instance}`
 * with the `apikey` header so we can confirm the URL/instance/apiKey trio
 * is wired correctly before saving Settings.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    url?: string
    instance?: string
    apiKey?: string
  }
  const { url, instance, apiKey } = body

  if (!url || !instance || !apiKey) {
    return NextResponse.json(
      { error: 'url, instance and apiKey are required' },
      { status: 400 }
    )
  }

  const endpoint = `${url.replace(/\/$/, '')}/instance/connectionState/${encodeURIComponent(instance)}`

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { ok: false, status: res.status, detail: text.slice(0, 200) },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      instance?: { state?: string; status?: string }
      state?: string
    }
    const state = data.instance?.state ?? data.state ?? 'unknown'
    return NextResponse.json({ ok: true, state })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Connection failed' },
      { status: 502 }
    )
  }
}
