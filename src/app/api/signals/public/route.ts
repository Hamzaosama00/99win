import { NextResponse } from 'next/server'
import { signalFor } from '@/lib/fair'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public global-round feed only. Personal signals, wallets and admin routes
// retain their existing authentication. AUTH_SECRET must match the game engine.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers })
}

export async function GET() {
  try {
    const base = process.env.SIGNALS_API_URL || 'http://127.0.0.1:3003'
    const response = await fetch(`${base.replace(/\/$/, '')}/engine-state`, {
      cache: 'no-store', signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) throw new Error('Engine unavailable')
    const state = await response.json()
    if (!Number.isSafeInteger(state.roundId) || state.roundId < 1 ||
      !['WAITING', 'FLYING', 'ENDED'].includes(state.phase) ||
      !Number.isFinite(state.serverTime) || !Array.isArray(state.history)) {
      throw new Error('Invalid engine state')
    }
    const rounds: Array<{ roundId: number; relation: 'PAST' | 'LIVE' | 'NEXT'; eff?: number; verdict?: string; target?: number | null }> = []
    // Historical values come from actual completed engine rounds, not forecasts.
    for (let index = Math.min(state.history.length, 14) - 1; index >= 0; index--) {
      const eff = state.history[index]
      if (!Number.isFinite(eff) || eff < 1) continue
      rounds.push({ roundId: state.roundId - index - (state.phase === 'ENDED' ? 0 : 1), eff, relation: 'PAST' })
    }
    for (const roundId of [state.roundId, state.roundId + 1]) {
      const signal = signalFor(roundId, 'GLOBAL')
      rounds.push({ roundId, verdict: signal.verdict, target: signal.target, relation: roundId === state.roundId ? 'LIVE' : 'NEXT' })
    }
    return NextResponse.json({
      scope: 'GLOBAL', serverTime: state.serverTime,
      engine: { roundId: state.roundId, phase: state.phase, endsAt: state.endsAt, startedAt: state.startedAt },
      rounds,
    }, { headers })
  } catch {
    return NextResponse.json({ error: 'Live signals are temporarily unavailable.' }, { status: 503, headers })
  }
}
