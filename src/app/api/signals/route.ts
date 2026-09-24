import { NextResponse } from 'next/server'
import { getTokenPayload, extractToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/signals — authenticated proxy to the game service's deterministic
 * signal engine. Every round's outcome is derived from HMAC(roundId, uid)
 * BEFORE the round starts, so the signals are mathematically accurate.
 */
export async function GET(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = extractToken(req) || ''
    const base =
      process.env.SIGNALS_API_URL || 'http://127.0.0.1:3004'
    const res = await fetch(
      `${base}/signal?rounds=14&token=${encodeURIComponent(token)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(3500) }
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Signal engine unavailable. Try again shortly.' },
        { status: 502 }
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Signal engine unreachable. Is the game service running?' },
      { status: 503 }
    )
  }
}
