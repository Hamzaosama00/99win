import crypto from 'node:crypto'

/**
 * 99win — Auth utilities (dependency-free, shared between Next API routes
 * and the socket.io game service).
 *
 * Tokens are HMAC-SHA256 signed JSON payloads — tamper-proof and stateless.
 * All financial operations re-verify identity server-side.
 */

const SECRET =
  process.env.AUTH_SECRET || '99win-demo-secret-2f8a1c9e-change-in-production'

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface TokenPayload {
  uid: string
  role: string
  iat: number
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(input: string): Buffer {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

function hmac(data: string): string {
  return b64url(crypto.createHmac('sha256', SECRET).update(data).digest())
}

export function signToken(uid: string, role: string): string {
  const payload: TokenPayload = { uid, role, iat: Date.now() }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${hmac(body)}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expected = hmac(body)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(b64urlDecode(body).toString()) as TokenPayload
    if (!payload.uid || Date.now() - payload.iat > TOKEN_TTL_MS) return null
    return payload
  } catch {
    return null
  }
}

// ---------- Passwords (scrypt, no external deps) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = crypto.scryptSync(password, salt, 32)
    const expected = Buffer.from(hash, 'hex')
    if (candidate.length !== expected.length) return false
    return crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// ---------- Request helpers ----------

export function extractToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

export function getTokenPayload(req: Request): TokenPayload | null {
  const token = extractToken(req)
  if (!token) return null
  return verifyToken(token)
}
