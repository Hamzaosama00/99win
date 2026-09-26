import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'

export const runtime = 'nodejs'

/** GET /api/wallet/transactions — my transaction log (latest 50) */
export async function GET(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const transactions = await db.transaction.findMany({
    where: { userId: payload.uid },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ transactions })
}
