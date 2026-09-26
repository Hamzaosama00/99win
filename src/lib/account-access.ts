import type { TokenPayload } from './auth'

export function sessionAllowed(user: { status?: string; sessionRevokedAt?: Date | string | null } | null, payload: TokenPayload) {
  return !!user && (user.status ?? 'ACTIVE') === 'ACTIVE' &&
    (!user.sessionRevokedAt || payload.iat > new Date(user.sessionRevokedAt).getTime())
}

export function isOnline(user: { status?: string; lastSeenAt?: Date | string | null }, now = Date.now()) {
  return (user.status ?? 'ACTIVE') === 'ACTIVE' && !!user.lastSeenAt &&
    now - new Date(user.lastSeenAt).getTime() < 60_000
}
