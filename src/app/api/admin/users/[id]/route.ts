import { NextResponse } from 'next/server'
import { getActiveSession } from '@/lib/session'
import { db } from '@/lib/db'
import { manageUser } from '@/lib/manage-user'

export const runtime = 'nodejs'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActiveSession(req)
  if (!actor || actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { action } = await req.json()
    const { id } = await context.params
    const user = await manageUser(db, actor, id, action)
    return NextResponse.json({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account update failed.'
    const expected = ['Invalid action.', 'Forbidden', 'User not found.', 'Administrator accounts are protected.', 'This account has been deleted.']
    if (!expected.includes(message)) console.error('Account update failed', error)
    return NextResponse.json({ error: expected.includes(message) ? message : 'Account update failed.' }, { status: message === 'Forbidden' ? 403 : expected.includes(message) ? 400 : 500 })
  }
}
