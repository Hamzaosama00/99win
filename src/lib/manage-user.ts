import type { DatabaseClient } from './firebase-store'
import type { TokenPayload } from './auth'
import { sessionAllowed } from './account-access.ts'

export async function manageUser(db: DatabaseClient, actor: TokenPayload, id: string, action: string) {
  const statuses: Record<string, string> = { ban: 'BANNED', block: 'BLOCKED', unblock: 'ACTIVE', delete: 'DELETED' }
  if (!Object.hasOwn(statuses, action)) throw new Error('Invalid action.')
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { id: actor.uid } })
    if (!sessionAllowed(admin, actor) || admin?.role !== 'ADMIN') throw new Error('Forbidden')
    const target = await tx.user.findUnique({ where: { id } })
    if (!target) throw new Error('User not found.')
    if (target.id === actor.uid || target.role === 'ADMIN') throw new Error('Administrator accounts are protected.')
    if (target.status === 'DELETED') throw new Error('This account has been deleted.')
    // Retain ledger references and pending settlements; deletion revokes all access.
    return tx.user.update({ where: { id }, data: {
      status: statuses[action],
      ...(action !== 'unblock' ? { sessionRevokedAt: new Date(), lastSeenAt: null } : {}),
    }, select: { id: true, status: true } })
  })
}
