import crypto from 'node:crypto'

/**
 * 99win — Deterministic (provably-reproducible) crash derivation.
 *
 * The GLOBAL crash point of every round and each player's PERSONAL crash
 * point are derived from HMAC-SHA256(secret, seed) instead of Math.random().
 * This lets the Signals service compute a round's outcome BEFORE it starts —
 * signals are mathematically accurate, not guesses. Players still cannot
 * predict anything (the secret lives server-side only).
 *
 * ⚠ Keep PROB values in sync with mini-services/game-service/config.ts.
 */

export const PROB = {
  HOUSE_EDGE: 0.04, // 4% house edge → RTP ≈ 96%
  INSTANT_CRASH_CHANCE: 0.03, // ~3% of rounds crash instantly at 1.00x
  MAX_CRASH: 500, // hard cap on multiplier generation
}

const SECRET =
  process.env.AUTH_SECRET || '99win-demo-secret-2f8a1c9e-change-in-production'

/** Deterministic uniform value in [0, 1) derived from a seed string. */
function hmacUnit(seed: string): number {
  const h = crypto.createHmac('sha256', SECRET).update(seed).digest()
  return h.readUIntBE(0, 6) / 281474976710656 // 48 bits → [0, 1)
}

/** Map a uniform sample onto the house-edge crash distribution. */
function crashFromUnit(u: number): number {
  if (u < PROB.INSTANT_CRASH_CHANCE) return 1.0
  const uu = (u - PROB.INSTANT_CRASH_CHANCE) / (1 - PROB.INSTANT_CRASH_CHANCE)
  const raw = (1 - PROB.HOUSE_EDGE) / (1 - uu)
  return Math.max(1.01, Math.min(PROB.MAX_CRASH, Math.floor(raw * 100) / 100))
}

/** Round-level GLOBAL crash point — the flight everyone watches. */
export function globalCrashFor(roundId: number): number {
  return crashFromUnit(hmacUnit(`99win:round:${roundId}:global`))
}

/**
 * Effective crash point for a user in a given round.
 * = min(personal crash, global crash) — the platform's per-user risk cap.
 * Passing uid 'GLOBAL' returns the raw global crash point.
 */
export function crashForRound(roundId: number, uid: string): number {
  if (uid === 'GLOBAL') return globalCrashFor(roundId)
  const global = globalCrashFor(roundId)
  const personal = crashFromUnit(hmacUnit(`99win:round:${roundId}:user:${uid}`))
  return Math.min(personal, global)
}

export type SignalVerdict = 'STRONG_BET' | 'SAFE_BET' | 'SKIP'

export interface SignalRow {
  roundId: number
  /** effective crash point for this user in this round (server secret) */
  eff: number
  verdict: SignalVerdict
  /** recommended auto-cashout target (null when skipping) */
  target: number | null
  /** suggested stake in PKR */
  stake: number
  confidence: number
}

/** Build the actionable signal for a round + user. */
export function signalFor(roundId: number, uid: string): SignalRow {
  const eff = crashForRound(roundId, uid)
  if (eff >= 2) {
    return {
      roundId,
      eff,
      verdict: 'STRONG_BET',
      target: Math.floor((eff - 0.05) * 100) / 100,
      stake: 300,
      confidence: 99,
    }
  }
  if (eff >= 1.35) {
    return {
      roundId,
      eff,
      verdict: 'SAFE_BET',
      target: Math.floor((eff - 0.05) * 100) / 100,
      stake: 100,
      confidence: 99,
    }
  }
  return { roundId, eff, verdict: 'SKIP', target: null, stake: 0, confidence: 99 }
}
