/**
 * 99win — money helpers, cashback tiers & game economy constants.
 * Client + server shared (pure functions only).
 */

export const MIN_BET = 16
export const MAX_BET = 10000
export const MIN_DEPOSIT = 100
export const MAX_DEPOSIT = 100000
export const MIN_WITHDRAW = 200
export const SIGNUP_BONUS = 100

/**
 * Tiered cashback on deposits:
 *   PKR 1000  → 15%
 *   PKR 1500  → 18%
 *   PKR 2000+ → 20%
 */
export function cashbackPercent(amount: number): number {
  if (amount >= 2000) return 20
  if (amount >= 1500) return 18
  if (amount >= 1000) return 15
  return 0
}

export function cashbackAmount(amount: number): number {
  const pct = cashbackPercent(amount)
  return Math.round(amount * pct) / 100 // amount * pct% rounded to 2dp
}

export function formatMoney(n: number, decimals = 0): string {
  return (
    'PKR ' +
    Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}x`
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  return phone.slice(0, 4) + '****' + phone.slice(-3)
}

export const DEPOSIT_PRESETS = [500, 1000, 1500, 2000, 5000, 10000]
