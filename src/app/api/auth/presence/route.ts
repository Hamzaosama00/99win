import { NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { sessionAllowed } from '@/lib/account-access'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export async function POST(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const active = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: payload.uid } })
    if (!sessionAllowed(user, payload)) return false
    await tx.user.update({ where: { id: payload.uid }, data: { lastSeenAt: new Date() } })
    return true
  })
  return NextResponse.json(active ? { ok: true } : { error: 'Account access revoked. Please log in again.' }, { status: active ? 200 : 401 })
}
