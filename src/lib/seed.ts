import { db } from '@/lib/db'
import { ensureAdmin } from './seed-admin'

/**
 * Lazy seeding — guarantees the admin account exists.
 * Called from auth routes so it survives any DB reset.
 *
 * Admin →  phone: 03182772524   password: hamza112233
 */
export async function ensureSeed(): Promise<void> {
  try {
    await ensureAdmin(db)
  } catch (e) {
    console.error('[99win] seed error', e)
  }
}

/** Public-safe user shape sent to clients. */
export function publicUser(u: {
  id: string
  phone: string
  name: string
  role: string
  balance: number
  totalDeposit: number
  totalWin: number
  totalLoss: number
  cashbackEarned: number
  createdAt: Date
}) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    balance: Math.round(u.balance * 100) / 100,
    totalDeposit: Math.round(u.totalDeposit * 100) / 100,
    totalWin: Math.round(u.totalWin * 100) / 100,
    totalLoss: Math.round(u.totalLoss * 100) / 100,
    cashbackEarned: Math.round(u.cashbackEarned * 100) / 100,
    createdAt: u.createdAt,
  }
}
