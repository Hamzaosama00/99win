/**
 * 99win — Game Service configuration.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  HOUSE EDGE is the platform sustainability lever.             │
 * │  0.04 → players recover ~96% of wagers long-term (RTP ~96%).  │
 * │  Raise it to tighten payouts, lower it to loosen them.        │
 * └────────────────────────────────────────────────────────────────┘
 */
export const CONFIG = {
  PORT: Number(process.env.GAME_PORT) || 3003,

  // ---- Probability engine ----
  HOUSE_EDGE: 0.04, // 4% house edge → RTP ≈ 96%
  INSTANT_CRASH_CHANCE: 0.03, // ~3% of rounds crash instantly at 1.00x
  MAX_CRASH: 500, // hard cap on multiplier generation

  // ---- Multiplier curve: m(t) = e^(GROWTH_RATE · t) ----
  GROWTH_RATE: 0.15, // 2x @ ~4.6s, 10x @ ~15.3s, 100x @ ~30.7s

  // ---- Round timings ----
  WAITING_MS: 7000, // betting window
  ENDED_MS: 4000, // "flew away" showcase
  TICK_MS: 100, // broadcast tick

  // ---- Economy ----
  MIN_BET: 16,
  MAX_BET: 10000,
  MIN_AUTO_CASHOUT: 1.01,
  MAX_AUTO_CASHOUT: 100,

  // ---- Bots / presence ----
  BOTS_MIN_PER_ROUND: 9,
  BOTS_MAX_PER_ROUND: 16,
  FAKE_PRESENCE_BASE: 128,
  FAKE_PRESENCE_SPREAD: 84,
  CHAT_MIN_INTERVAL_MS: 6500,
  CHAT_MAX_INTERVAL_MS: 15000,
}
