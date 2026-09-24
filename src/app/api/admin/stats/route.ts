import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

export const runtime = 'nodejs'

/** GET /api/admin/stats — platform overview for the admin dashboard */
export async function GET(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [users, pendingDeposits, pendingWithdrawals, bets] = await Promise.all([
    db.user.count(),
    db.transaction.count({ where: { status: 'PENDING', type: 'DEPOSIT' } }),
    db.transaction.count({ where: { status: 'PENDING', type: 'WITHDRAW' } }),
    db.bet.findMany({
      where: { status: { in: ['CASHED_OUT', 'CRASHED'] } },
      select: { amount: true, winAmount: true },
    }),
  ])

  const depositAgg = await db.transaction.aggregate({
    where: { type: 'DEPOSIT', status: 'APPROVED' },
    _sum: { amount: true },
  })
  const withdrawAgg = await db.transaction.aggregate({
    where: { type: 'WITHDRAW', status: 'COMPLETED' },
    _sum: { amount: true },
  })

  const wagered = bets.reduce((s, b) => s + b.amount, 0)
  const paidOut = bets.reduce((s, b) => s + (b.winAmount || 0), 0)

  return NextResponse.json({
    stats: {
      users,
      pendingDeposits,
      pendingWithdrawals,
      totalDeposited: depositAgg._sum.amount || 0,
      totalWithdrawn: withdrawAgg._sum.amount || 0,
      totalBets: bets.length,
      wagered: Math.round(wagered * 100) / 100,
      paidOut: Math.round(paidOut * 100) / 100,
      houseProfit: Math.round((wagered - paidOut) * 100) / 100,
    },
  })
}
