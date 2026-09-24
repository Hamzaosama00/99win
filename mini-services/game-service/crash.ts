import { CONFIG } from './config'

/**
 * Crash point generation — the probability engine.
 *
 * P(crash ≥ x) = (1 − house_edge) / x   for x > 1
 * plus a fixed slice of instant 1.00x crashes.
 *
 * Every round the GLOBAL display crash point and every player's PERSONAL
 * crash point are drawn independently from this distribution — the
 * effective outcome for a player is min(personal, global), which lets the
 * platform manage risk per user session while everyone watches the same
 * shared flight.
 */
export function generateCrashPoint(): number {
  if (Math.random() < CONFIG.INSTANT_CRASH_CHANCE) return 1.0
  const u = Math.random()
  const raw = (1 - CONFIG.HOUSE_EDGE) / (1 - u)
  const capped = Math.min(raw, CONFIG.MAX_CRASH)
  return Math.max(1.01, Math.floor(capped * 100) / 100)
}

/** Multiplier at elapsed time t (seconds): e^(rate·t), floored at 1.00 */
export function multiplierAt(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / 1000
  return Math.exp(CONFIG.GROWTH_RATE * t)
}

/** Round a multiplier down to 2 decimals (fair payout basis). */
export function floor2(m: number): number {
  return Math.floor(m * 100) / 100
}

/** Payout = stake × multiplier, rounded down to paisa. */
export function payoutFor(amount: number, m: number): number {
  return Math.floor(amount * floor2(m) * 100) / 100
}
