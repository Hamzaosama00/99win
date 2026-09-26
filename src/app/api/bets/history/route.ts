import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'

export const runtime = 'nodejs'

/** GET /api/bets/history — my bet history (latest 30) */
export async function GET(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const bets = await db.bet.findMany({
    where: { userId: payload.uid },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ bets })
}
