import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'

export const runtime = 'nodejs'

/** GET /api/admin/transactions?status=PENDING&type=DEPOSIT — transaction management feed */
export async function GET(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const type = url.searchParams.get('type') || undefined

  const transactions = await db.transaction.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: { id: true, phone: true, name: true, balance: true },
      },
    },
  })
  return NextResponse.json({ transactions })
}
