import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { verifyToken } from '../../src/lib/auth'
import { GameEngine } from './engine'
import { CONFIG } from './config'
import { signalFor } from '../../src/lib/fair'

// ---- env bootstrap (DATABASE_URL from project root .env) ----
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(import.meta.dir, '../../.env')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
      }
    }
  } catch (e) {
    console.error('[99win] env load failed', e)
  }
}

const db = new PrismaClient()

// ---- stale bet cleanup (server restarted mid-flight → refund) ----
async function cleanupStaleBets() {
  const stale = await db.bet.findMany({ where: { status: 'ACTIVE' } })
  for (const b of stale) {
    await db.$transaction([
      db.bet.update({ where: { id: b.id }, data: { status: 'CANCELLED' } }),
      db.user.update({ where: { id: b.userId }, data: { balance: { increment: b.amount } } }),
    ])
    console.log(`[99win] refunded stale bet ${b.id}`)
  }
}

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards via XTransformPort
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---- handshake auth (guests may watch, betting requires identity) ----
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined
  const payload = token ? verifyToken(token) : null
  socket.data.uid = payload?.uid ?? null
  socket.data.role = payload?.role ?? 'GUEST'
  next()
})

let engine: GameEngine

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

  // full snapshot on connect
  socket.emit('game:state', engine.stateFor(uid))
  socket.emit('chat:history', { messages: engine.chatHistory.slice(-40) })

  // ---- betting ----
  socket.on('game:bet', async (data: { amount: number; autoCashout: number | null }) => {
    if (!uid) return socket.emit('bet:error', { message: 'Login required to place bets.' })
    const amount = Number(data?.amount)
    const auto =
      data?.autoCashout === null || data?.autoCashout === undefined
        ? null
        : Number(data.autoCashout)
    const res = await engine.placeBet(uid, String(socket.data.name), amount, auto)
    if (!res.ok) socket.emit('bet:error', { message: res.error })
    else
      socket.emit('bet:accepted', {
        betId: res.betId,
        roundId: engine.roundId,
        amount,
        autoCashout: auto,
        balance: res.balance,
      })
  })

  socket.on('game:cancel', async () => {
    if (!uid) return
    const res = await engine.cancelBet(uid)
    if (!res.ok) socket.emit('bet:error', { message: res.error })
    else socket.emit('bet:cancelled', { balance: res.balance })
  })

  socket.on('game:cashout', () => {
    if (!uid) return
    const res = engine.cashout(uid)
    if (!res.ok) socket.emit('bet:error', { message: res.error })
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

// ---- internal Signals HTTP API (localhost only — proxied by Next.js /api/signals) ----
if (typeof Bun !== 'undefined') {
  Bun.serve({
    port: CONFIG.SIGNALS_PORT,
    hostname: CONFIG.SIGNALS_HOST,
    fetch(req) {
      if (!engine) return new Response('Service starting', { status: 503 })
      const url = new URL(req.url)

      if (url.pathname === '/engine-state') {
        return Response.json({
          serverTime: Date.now(),
          roundId: engine.roundId,
          phase: engine.phase,
          endsAt: engine.phaseEndsAt,
          startedAt: engine.startedAt,
          history: engine.history.slice(0, 25),
        })
      }

      if (url.pathname === '/signal') {
        // identity comes from the signed token — never trust a raw uid param
        // (mandatory once the signals host is bound publicly)
        const token = url.searchParams.get('token') || ''
        const payload = token ? verifyToken(token) : null
        const uid = payload?.uid ?? null
        if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const past = Math.min(Math.max(Number(url.searchParams.get('rounds') ?? 14), 4), 30)
        const first = engine.roundId - past
        const rounds = []
        for (let r = first; r <= engine.roundId + 1; r++) {
          const sig = signalFor(r, uid)
          const relation =
            r < engine.roundId ? 'PAST' : r === engine.roundId ? 'LIVE' : 'NEXT'
          // accuracy check: a BET signal hits when the round reached its target,
          // a SKIP signal is correct when the round crashed below 1.35x
          const hit =
            relation !== 'PAST'
              ? null
              : sig.verdict === 'SKIP'
                ? sig.eff < 1.35
                : sig.target !== null && sig.eff >= sig.target
          rounds.push({ ...sig, relation, hit })
        }
        return Response.json({
          serverTime: Date.now(),
          engine: {
            roundId: engine.roundId,
            phase: engine.phase,
            endsAt: engine.phaseEndsAt,
            startedAt: engine.startedAt,
          },
          history: engine.history.slice(0, 25),
          rounds,
        })
      }

      return new Response('Not found', { status: 404 })
    },
  })
  console.log(`[99win] signals api listening on 127.0.0.1:${CONFIG.SIGNALS_PORT}`)
}

// ---- boot ----
async function main() {
  await cleanupStaleBets()
  engine = new GameEngine(io, db)
  httpServer.listen(CONFIG.PORT, () => {
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
