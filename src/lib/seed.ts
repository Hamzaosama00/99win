import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

/**
 * Lazy seeding — guarantees the admin account exists.
 * Called from auth routes so it survives any DB reset.
 *
 * Admin →  phone: 03182772524   password: hamza112233
 */
export async function ensureSeed(): Promise<void> {
  try {
    const admin = await db.user.findUnique({
      where: { phone: '03182772524' },
    })
    if (!admin) {
      await db.user.create({
        data: {
          phone: '03182772524',
          name: 'Admin',
          password: hashPassword('hamza112233'),
          role: 'ADMIN',
          balance: 0,
        },
      })
      console.log('[99win] seeded admin account (03182772524)')
    }

    // remove the old demo admin account if it still exists from earlier builds
    try {
      const legacy = await db.user.findUnique({ where: { phone: '03000000000' } })
      if (legacy && legacy.id !== admin?.id) {
        await db.bet.deleteMany({ where: { userId: legacy.id } })
        await db.transaction.deleteMany({ where: { userId: legacy.id } })
        await db.user.delete({ where: { id: legacy.id } })
        console.log('[99win] removed legacy demo admin account')
      }
    } catch (e) {
      console.error('[99win] legacy admin cleanup skipped', e)
    }
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
