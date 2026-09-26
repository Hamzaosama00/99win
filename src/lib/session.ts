import { getTokenPayload } from './auth'
import { db } from './db'
import { sessionAllowed } from './account-access'

export async function getActiveSession(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload) return null
  const user = await db.user.findUnique({ where: { id: payload.uid } })
  return sessionAllowed(user, payload) ? { ...payload, role: user!.role } : null
}
