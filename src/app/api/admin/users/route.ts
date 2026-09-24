import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

export const runtime = 'nodejs'

async function requireAdmin(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

/** GET /api/admin/users — all registered users with wallet statistics */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      balance: true,
      totalDeposit: true,
      totalWin: true,
      totalLoss: true,
      cashbackEarned: true,
      createdAt: true,
    },
  })
  const counts = await db.bet.groupBy({
    by: ['userId'],
    _count: { id: true },
    _sum: { amount: true, winAmount: true },
  })
  const betMap = new Map(counts.map((c) => [c.userId, c]))
  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      betsCount: betMap.get(u.id)?._count.id ?? 0,
      wagered: betMap.get(u.id)?._sum.amount ?? 0,
      paidOut: betMap.get(u.id)?._sum.winAmount ?? 0,
    })),
  })
}
