import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { publicUser } from '@/lib/seed'

export const runtime = 'nodejs'

/** GET /api/auth/me — session bootstrap */
export async function GET(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await db.user.findUnique({ where: { id: payload.uid } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ user: publicUser(user) })
}
