import { createServer } from 'http'
import { Server } from 'socket.io'
import { db } from '../../src/lib/db'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sessionAllowed } from '../../src/lib/account-access'
import { verifyToken } from '../../src/lib/auth'
import { GameEngine } from './engine'
import { CONFIG } from './config'
import { signalFor } from '../../src/lib/fair'

// ---- env bootstrap (Firebase server credential from project root .env) ----
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && !process.env[m[1]]) {
          const value = m[2].trim()
          process.env[m[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value
        }
      }
    }
  } catch (e) {
    console.error('[99win] env load failed', e)
  }
}


// ---- stale bet cleanup (server restarted mid-flight → refund) ----
async function cleanupStaleBets() {
  const stale = await db.bet.findMany({ where: { status: 'ACTIVE' } })
  for (const b of stale) {
    await db.$transaction([
      db.bet.update({ where: { id: b.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
      db.user.update({ where: { id: b.userId }, data: { balance: { increment: b.amount } } }),
    ])
    console.log(`[99win] refunded stale bet ${b.id}`)
  }
}

// Render exposes a single public HTTP port, so Socket.IO and Signals share it.
let engine: GameEngine
const httpServer = createServer(async (req, res) => {
  const sendJson = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  if (!engine) return sendJson(503, { error: 'Service starting' })
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/healthz') {
    return sendJson(200, { ok: true, roundId: engine.roundId, phase: engine.phase })
  }
  if (url.pathname === '/engine-state') {
    return sendJson(200, {
      serverTime: Date.now(), roundId: engine.roundId, phase: engine.phase,
      endsAt: engine.phaseEndsAt, startedAt: engine.startedAt,
      history: engine.history.slice(0, 25),
    })
  }
  if (url.pathname === '/signal') {
    // Identity is obtained only from a signed token; never trust a raw uid param.
    const token = url.searchParams.get('token') || ''
    const payload = token ? verifyToken(token) : null
    const uid = payload?.uid ?? null
    if (!uid) return sendJson(401, { error: 'Unauthorized' })
    try {
      if (!sessionAllowed(await db.user.findUnique({ where: { id: uid } }), payload!)) return sendJson(403, { error: 'Account unavailable' })
    } catch { return sendJson(503, { error: 'Service unavailable' }) }
    const rawRounds = Number(url.searchParams.get('rounds') ?? 14)
    const past = Number.isFinite(rawRounds) ? Math.min(Math.max(rawRounds, 4), 30) : 14
    const first = engine.roundId - past
    const rounds: Array<ReturnType<typeof signalFor> & { relation: string; hit: boolean | null }> = []
    for (let r = first; r <= engine.roundId + 1; r++) {
      const sig = signalFor(r, uid)
      const relation = r < engine.roundId ? 'PAST' : r === engine.roundId ? 'LIVE' : 'NEXT'
      const hit = relation !== 'PAST' ? null
        : sig.verdict === 'SKIP' ? sig.eff < 1.35
        : sig.target !== null && sig.eff >= sig.target
      rounds.push({ ...sig, relation, hit })
    }
    return sendJson(200, {
      serverTime: Date.now(),
      engine: {
        roundId: engine.roundId, phase: engine.phase,
        endsAt: engine.phaseEndsAt, startedAt: engine.startedAt,
      },
      history: engine.history.slice(0, 25), rounds,
    })
  }
  return sendJson(404, { error: 'Not found' })
})
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---- handshake auth (guests may watch, betting requires identity) ----
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined
  const payload = token ? verifyToken(token) : null
  if (token) {
    try {
      const user = payload ? await db.user.findUnique({ where: { id: payload.uid } }) : null
      if (!payload || !sessionAllowed(user, payload)) return next(new Error('Account unavailable'))
    } catch { return next(new Error('Account verification unavailable')) }
  }
  socket.data.session = payload
  socket.data.uid = payload?.uid ?? null
  socket.data.role = payload?.role ?? 'GUEST'
  next()
})

io.on('connection', async (socket) => {
  const uid = socket.data.uid as string | null

  if (uid) {
    socket.join(`user:${uid}`)
    try {
      const user = await db.user.findUnique({ where: { id: uid } })
      socket.data.name = user?.name ?? 'Player'
    } catch {
      socket.data.name = 'Player'
    }
  }

  const checkAccess = async () => {
    if (!uid) return true
    const user = await db.user.findUnique({ where: { id: uid } })
    if (sessionAllowed(user, socket.data.session)) return true
    socket.emit('account:revoked')
    socket.disconnect(true)
    return false
  }
  socket.use(async (_packet, next) => {
    try { if (await checkAccess()) next(); else next(new Error('Account unavailable')) }
    catch { next(new Error('Account verification unavailable')) }
  })
  const accessTimer = setInterval(() => { checkAccess().catch(() => socket.disconnect(true)) }, 10000)
  socket.on('disconnect', () => clearInterval(accessTimer))

  // full snapshot on connect
  socket.emit('game:state', engine.stateFor(uid))
  socket.emit('chat:history', { messages: engine.chatHistory.slice(-40) })

  // ---- betting ----
  socket.on('game:bet', async (data: { amount: number; autoCashout: number | null; slot?: number }) => {
    if (!uid) return socket.emit('bet:error', { message: 'Login required to place bets.' })
    const slot = data?.slot ?? 0
    const amount = Number(data?.amount)
    const auto =
      data?.autoCashout === null || data?.autoCashout === undefined
        ? null
        : Number(data.autoCashout)
    const res = await engine.placeBet(uid, String(socket.data.name), amount, auto, slot)
    if (!res.ok) socket.emit('bet:error', { message: res.error, slot })
    else
      socket.emit('bet:accepted', {
        slot,
        betId: res.betId,
        roundId: engine.roundId,
        amount,
        autoCashout: auto,
        balance: res.balance,
      })
  })

  socket.on('game:cancel', async (data?: { slot?: number }) => {
    const slot = data?.slot ?? 0
    if (!uid) return
    const res = await engine.cancelBet(uid, slot)
    if (!res.ok) socket.emit('bet:error', { message: res.error, slot })
    else socket.emit('bet:cancelled', { balance: res.balance, slot })
  })

  socket.on('game:cashout', (data?: { slot?: number }) => {
    const slot = data?.slot ?? 0
    if (!uid) return
    const res = engine.cashout(uid, slot)
    if (!res.ok) socket.emit('bet:error', { message: res.error, slot })
  })

  socket.on('wallet:sync', async () => {
    if (!uid) return
    try {
      const user = await db.user.findUnique({ where: { id: uid } })
      if (user)
        socket.emit('wallet:update', {
          balance: Math.round(user.balance * 100) / 100,
          totalWin: Math.round(user.totalWin * 100) / 100,
          totalLoss: Math.round(user.totalLoss * 100) / 100,
        })
    } catch {}
  })

  // ---- chat ----
  socket.on('chat:send', (data: { text: string }) => {
    if (!uid) return socket.emit('chat:error', { message: 'Login to chat.' })
    const hue = Math.abs(
      uid.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
    )
    const res = engine.userChat(uid, String(socket.data.name), hue, String(data?.text ?? ''))
    if (!res.ok) socket.emit('chat:error', { message: res.error })
  })

  socket.on('disconnect', () => {})
})

// ---- boot ----
async function main() {
  await cleanupStaleBets()
  engine = new GameEngine(io, db)
  httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[99win] game service running on port ${CONFIG.PORT}`)
  })
}

main().catch((e) => {
  console.error('[99win] fatal boot error', e)
  process.exit(1)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
