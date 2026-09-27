import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'
import { reviewTransaction } from '@/lib/transaction-review'

export const runtime = 'nodejs'
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveSession(req)
  if (!actor || actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== 'string' || (body.reason !== undefined && typeof body.reason !== 'string') || (body.cashbackId !== undefined && typeof body.cashbackId !== 'string')) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  try {
    const { id } = await params
    const result = await reviewTransaction(db, actor, id, body.action, body.reason, body.cashbackId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed.'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}
