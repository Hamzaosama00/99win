import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: Request) {
  const actor = await getActiveSession(req)
  if (!actor || actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const query = new URL(req.url).searchParams
  const status = query.get('status') || undefined, type = query.get('type') || undefined, userId = query.get('userId') || undefined
  const search = (query.get('search') || '').trim().toLowerCase().slice(0, 200)
  const page = Math.max(1, Math.floor(Number(query.get('page')) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.get('pageSize')) || 50)))
  if (!Number.isFinite(page)) return NextResponse.json({ error: 'Invalid page.' }, { status: 400 })
  const records = await db.transaction.findMany({ where: { status, type, userId }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, phone: true, name: true, balance: true } } } })
  const filtered = records.filter(t => !search || [t.id, t.txnId, t.account, t.user.name, t.user.phone, t.userId, t.note, t.reversalReason].some(value => String(value || '').toLowerCase().includes(search)))
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / pageSize)), currentPage = Math.min(page, pages)
  return NextResponse.json({ transactions: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), total, page: currentPage, pages, pageSize }, { headers: { 'Cache-Control': 'no-store' } })
}
