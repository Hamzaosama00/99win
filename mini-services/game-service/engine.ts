import type { Server } from 'socket.io'
import type { DatabaseClient } from '../../src/lib/firebase-store'
import { CONFIG } from './config'
import { multiplierAt, floor2, payoutFor } from './crash'
import { globalCrashFor, crashForRound } from '../../src/lib/fair'
import {
  pickRandomBots, randomBotAmount, randomBotTarget, randomBotCrash,
  pick, botCashoutLine, CHAT_GENERAL, CHAT_WAITING, CHAT_AFTER_LOW_CRASH,
  CHAT_AFTER_HIGH_CRASH,
} from './bots'

export type Phase = 'WAITING' | 'FLYING' | 'ENDED'

export interface Entry {
  slot?: number
  betId: string
  userId: string
  name: string
  hue: number
  amount: number
  personalCrash: number // SECRET — server-side only
  autoCashout: number | null
  isBot: boolean
  status: 'ACTIVE' | 'WON' | 'LOST'
  cashoutM: number | null
  win: number | null
}

export interface ChatMsg {
  id: string
  name: string
  hue: number
  text: string
  ts: number
  kind: 'user' | 'bot' | 'system'
}

export interface LeaderRow {
  name: string
  hue: number
  multiplier: number
  win: number
  ts: number
}

const publicEntry = (e: Entry) => ({
  betId: e.betId,
  name: e.name,
  hue: e.hue,
  amount: e.amount,
  status: e.status,
  cashoutM: e.cashoutM,
  win: e.win,
  isBot: e.isBot,
})

const msgId = () => Math.random().toString(36).slice(2, 11)
const uidHue = (uid: string) => {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360
  return h
}

export class GameEngine {
  io: Server
  db: DatabaseClient

  phase: Phase = 'WAITING'
  roundId = 1000
  phaseEndsAt = 0
  startedAt = 0
  globalCrash = 1
  history: number[] = []
  entries = new Map<string, Entry>()
  leaderboard: LeaderRow[] = []
  chatHistory: ChatMsg[] = []
  lastCrash: number | null = null
  private pendingBets = new Set<string>()
  private fakeOnline = CONFIG.FAKE_PRESENCE_BASE
  private lastFeedAt = 0
  private chatLastAt = new Map<string, number>()
  private mainTimer: ReturnType<typeof setTimeout> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null

  constructor(io: Server, db: DatabaseClient) {
    this.io = io
    this.db = db
    this.startWaiting()
    this.startPresenceLoop()
  }

  // ---------------- lifecycle ----------------

  startWaiting() {
    this.phase = 'WAITING'
    this.roundId++
    this.entries.clear()
    this.phaseEndsAt = Date.now() + CONFIG.WAITING_MS
    this.io.emit('game:waiting', {
      roundId: this.roundId,
      endsAt: this.phaseEndsAt,
      serverTime: Date.now(),
      history: this.history.slice(0, 25),
    })
    this.systemChat(`Round #${this.roundId} — place your bets! :plane:`)
    this.scheduleBots()
    this.mainTimer = setTimeout(() => this.startFlying(), CONFIG.WAITING_MS)
  }

  private scheduleBots() {
    const bots = pickRandomBots(CONFIG.BOTS_MIN_PER_ROUND, CONFIG.BOTS_MAX_PER_ROUND)
    for (const bot of bots) {
      const delay = 500 + Math.random() * (CONFIG.WAITING_MS - 1500)
      setTimeout(() => {
        if (this.phase !== 'WAITING' || this.entries.has(bot.id)) return
        const entry: Entry = {
          betId: `bot-${this.roundId}-${bot.id}`,
          userId: bot.id,
          name: bot.name,
          hue: bot.hue,
          amount: randomBotAmount(),
          personalCrash: randomBotCrash(),
          autoCashout: randomBotTarget(),
          isBot: true,
          status: 'ACTIVE',
          cashoutM: null,
          win: null,
        }
        this.entries.set(bot.id, entry)
        this.io.emit('bets:add', publicEntry(entry))
      }, delay)
    }
  }

  startFlying() {
    this.phase = 'FLYING'
    // deterministic round seed — identical to what the Signals service computes
    this.globalCrash = globalCrashFor(this.roundId)
    this.startedAt = Date.now()
    this.io.emit('game:started', {
      roundId: this.roundId,
      startedAt: this.startedAt,
      serverTime: Date.now(),
    })
    this.tickTimer = setInterval(() => this.tick(), CONFIG.TICK_MS)
  }

  tick() {
    const elapsed = Date.now() - this.startedAt
    const rawM = multiplierAt(elapsed)

    // Auto cash-outs fire FIRST — a target below the effective crash
    // point (min of personal & global) always wins, even on the crash tick
    for (const e of this.entries.values()) {
      if (e.status !== 'ACTIVE') continue
      const eff = Math.min(e.personalCrash, this.globalCrash)
      if (e.autoCashout && e.autoCashout <= rawM && e.autoCashout < eff) {
        this.resolveCashout(e, e.autoCashout)
      }
    }

    if (rawM >= this.globalCrash) {
      this.crash()
      return
    }

    const m = floor2(rawM)
    this.io.emit('game:tick', { tMs: elapsed, m, serverTime: Date.now() })

    for (const e of this.entries.values()) {
      if (e.status !== 'ACTIVE') continue
      const eff = Math.min(e.personalCrash, this.globalCrash)
      // m < globalCrash here, so m >= eff implies a personal crash
      if (m >= eff) this.resolveLoss(e, eff)
    }
  }

  crash() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
    this.phase = 'ENDED'
    this.phaseEndsAt = Date.now() + CONFIG.ENDED_MS
    const m = this.globalCrash
    for (const e of this.entries.values()) {
      if (e.status === 'ACTIVE') this.resolveLoss(e, m)
    }
    this.lastCrash = m
    this.history.unshift(m)
    if (this.history.length > 30) this.history.length = 30
    this.io.emit('game:ended', {
      roundId: this.roundId,
      crashPoint: m,
      serverTime: Date.now(),
    })
    if (m >= 5) this.systemChat(`:rocket: Flew away at ${m.toFixed(2)}x — what a flight!`)
    else if (Math.random() < 0.4) this.systemChat(`:boom: Flew away at ${m.toFixed(2)}x`)
    if (Math.random() < 0.5) this.botReactToCrash(m)
    this.mainTimer = setTimeout(() => this.startWaiting(), CONFIG.ENDED_MS)
  }

  private botReactToCrash(m: number) {
    const bots = pickRandomBots(1, 2)
    for (const b of bots) {
      const text = m >= 5 ? pick(CHAT_AFTER_HIGH_CRASH) : pick(CHAT_AFTER_LOW_CRASH)
      this.pushChat({ id: msgId(), name: b.name, hue: b.hue, text, ts: Date.now(), kind: 'bot' })
    }
  }

  // ---------------- resolution ----------------

  resolveCashout(e: Entry, m: number) {
    if (e.status !== 'ACTIVE') return
    const win = payoutFor(e.amount, m)
    e.status = 'WON'
    e.cashoutM = m
    e.win = win

    if (e.isBot) {
      this.io.emit('bets:update', { betId: e.betId, status: 'WON', multiplier: m, win })
      this.pushFeed(e.name, e.hue, m, win)
      const line = botCashoutLine(m, win)
      if (line) {
        this.pushChat({ id: msgId(), name: e.name, hue: e.hue, text: line, ts: Date.now(), kind: 'bot' })
      }
      return
    }

    // Real user — server-side financial mutation
    this.db
      .$transaction([
        this.db.bet.update({
          where: { id: e.betId, status: 'ACTIVE' },
          data: { status: 'CASHED_OUT', cashedOutAt: m, winAmount: win },
        }),
        this.db.user.update({
          where: { id: e.userId },
          data: { balance: { increment: win }, totalWin: { increment: win } },
        }),
      ])
      .then(([, u]) => {
        this.io.in(`user:${e.userId}`).emit('wallet:update', {
          balance: Math.round(u.balance * 100) / 100,
          totalWin: Math.round(u.totalWin * 100) / 100,
        })
        this.io.in(`user:${e.userId}`).emit('game:user_cashed_out', {
          roundId: this.roundId,
          betId: e.betId,
          slot: e.slot ?? 0,
          multiplier: m,
          win,
          balance: Math.round(u.balance * 100) / 100,
        })
      })
      .catch((err) => console.error('[99win] cashout db error', err))

    this.io.emit('bets:update', { betId: e.betId, status: 'WON', multiplier: m, win })
    this.pushFeed(e.name, e.hue, m, win)
  }

  resolveLoss(e: Entry, crashM: number) {
    if (e.status !== 'ACTIVE') return
    e.status = 'LOST'

    this.io.emit('bets:update', { betId: e.betId, status: 'LOST' })

    if (e.isBot) return
    this.db
      .$transaction([
        this.db.bet.update({
          where: { id: e.betId, status: 'ACTIVE' },
          data: { status: 'CRASHED' },
        }),
        this.db.user.update({
          where: { id: e.userId },
          data: { totalLoss: { increment: e.amount } },
        }),
      ])
      .then(([, u]) => {
        this.io.in(`user:${e.userId}`).emit('wallet:update', {
          balance: Math.round(u.balance * 100) / 100,
          totalLoss: Math.round(u.totalLoss * 100) / 100,
        })
        this.io.in(`user:${e.userId}`).emit('game:user_crashed', {
          roundId: this.roundId,
          betId: e.betId,
          slot: e.slot ?? 0,
          crashPoint: crashM,
          loss: e.amount,
        })
      })
      .catch((err) => console.error('[99win] loss db error', err))
  }

  private pushFeed(name: string, hue: number, multiplier: number, win: number) {
    const row: LeaderRow = { name, hue, multiplier, win, ts: Date.now() }
    this.leaderboard.push(row)
    this.leaderboard.sort((a, b) => b.win - a.win)
    if (this.leaderboard.length > 10) this.leaderboard.length = 10
    this.io.emit('leaderboard:update', { leaderboard: this.leaderboard })
    const now = Date.now()
    if (win >= 100 && now - this.lastFeedAt > 1500) {
      this.lastFeedAt = now
      this.io.emit('game:win_feed', { name, hue, multiplier, win })
    }
  }

  // ---------------- API for socket handlers ----------------

  stateFor(uid: string | null) {
    const myBet = uid ? this.entries.get(`${uid}:0`) : undefined
    const myBets = Array.from(this.entries.values()).filter(e => !e.isBot && e.userId === uid).map(e => ({ betId: e.betId, slot: e.slot ?? 0, amount: e.amount, autoCashout: e.autoCashout, status: e.status, cashoutM: e.cashoutM, win: e.win }))
    return {
      serverTime: Date.now(),
      onlineCount: this.fakeOnline + this.io.sockets.sockets.size,
      roundId: this.roundId,
      phase: this.phase,
      endsAt: this.phase === 'WAITING' || this.phase === 'ENDED' ? this.phaseEndsAt : null,
      startedAt: this.phase === 'FLYING' ? this.startedAt : null,
      multiplier: this.phase === 'FLYING' ? floor2(multiplierAt(Date.now() - this.startedAt)) : null,
      history: this.history.slice(0, 25),
      bets: Array.from(this.entries.values()).map(publicEntry),
      leaderboard: this.leaderboard,
      myBets,
      myBet: myBet
        ? {
            betId: myBet.betId,
            amount: myBet.amount,
            autoCashout: myBet.autoCashout,
            status: myBet.status,
            cashoutM: myBet.cashoutM,
            win: myBet.win,
          }
        : null,
    }
  }

  async placeBet(
    uid: string,
    name: string,
    amount: number,
    autoCashout: number | null,
    slot = 0
  ): Promise<{ ok: boolean; error?: string; betId?: string; balance?: number }> {
    if (this.phase !== 'WAITING') {
      return { ok: false, error: 'Betting is closed — wait for the next round.' }
    }
    if (slot !== 0 && slot !== 1) return { ok: false, error: 'Invalid bet panel.' }
    const key = `${uid}:${slot}`
    if (this.entries.has(key) || this.pendingBets.has(key)) {
      return { ok: false, error: 'You already have a bet this round.' }
    }
    if (!Number.isFinite(amount) || !Number.isInteger(amount) ||
        amount < CONFIG.MIN_BET || amount > CONFIG.MAX_BET) {
      return { ok: false, error: `Bet must be PKR ${CONFIG.MIN_BET} – PKR ${CONFIG.MAX_BET}.` }
    }
    if (autoCashout !== null && (!Number.isFinite(autoCashout) ||
        autoCashout < CONFIG.MIN_AUTO_CASHOUT || autoCashout > CONFIG.MAX_AUTO_CASHOUT)) {
      return { ok: false, error: 'Auto cash out must be between 1.01x and 100x.' }
    }

    // Deterministic per-user crash point (HMAC of roundId + uid) — the
    // Signals service derives the exact same value, so signals are accurate.
    const personalCrash = crashForRound(this.roundId, uid)
    const roundId = this.roundId
    this.pendingBets.add(key)
    try {
      const res = await this.db.$transaction(async (tx) => {
        if (this.phase !== 'WAITING' || this.roundId !== roundId) throw new Error('Betting closed.')
        const account = await tx.user.findUnique({ where: { id: uid } })
        if (!account || account.status !== 'ACTIVE') throw new Error('Account unavailable.')
        const r = await tx.user.updateMany({
          where: { id: uid, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        })
        if (r.count === 0) return null
        const bet = await tx.bet.create({
          data: {
            userId: uid,
            roundId,
            amount,
            crashPoint: personalCrash,
            status: 'ACTIVE',
          },
        })
        const user = await tx.user.findUnique({ where: { id: uid } })
        return { bet, user }
      })

      if (!res || !res.user) {
        return { ok: false, error: 'Insufficient balance.' }
      }

      if (this.phase !== 'WAITING' || this.roundId !== roundId) {
        await this.db.$transaction([
          this.db.bet.update({ where: { id: res.bet.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
          this.db.user.update({ where: { id: uid }, data: { balance: { increment: amount } } }),
        ])
        return { ok: false, error: 'Round started. Your bet was refunded.' }
      }
      const entry: Entry = {
        slot,
        betId: res.bet.id,
        userId: uid,
        name,
        hue: uidHue(uid),
        amount,
        personalCrash,
        autoCashout,
        isBot: false,
        status: 'ACTIVE',
        cashoutM: null,
        win: null,
      }
      this.entries.set(key, entry)
      this.io.emit('bets:add', publicEntry(entry))
      return {
        ok: true,
        betId: res.bet.id,
        balance: Math.round(res.user.balance * 100) / 100,
      }
    } catch (err) {
      console.error('[99win] placeBet error', err)
      return { ok: false, error: 'Bet failed. Try again.' }
    } finally { this.pendingBets.delete(key) }
  }

  async cancelBet(uid: string, slot = 0) {
    if (slot !== 0 && slot !== 1) return { ok: false, error: 'Invalid bet panel.' }
    if (this.phase !== 'WAITING') {
      return { ok: false, error: 'Too late to cancel — the round has started.' }
    }
    const e = this.entries.get(`${uid}:${slot}`)
    if (!e || e.isBot || e.status !== 'ACTIVE') {
      return { ok: false, error: 'No active bet to cancel.' }
    }
    const key = `${uid}:${slot}`
    this.pendingBets.add(key)
    this.entries.delete(key)
    try {
      const [, u] = await this.db.$transaction([
        this.db.bet.update({ where: { id: e.betId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
        this.db.user.update({ where: { id: uid }, data: { balance: { increment: e.amount } } }),
      ])
      this.io.emit('bets:remove', { betId: e.betId })
      return { ok: true, balance: Math.round(u.balance * 100) / 100 }
    } catch (err) {
      console.error('[99win] cancel error', err)
      this.entries.set(`${uid}:${slot}`, e)
      return { ok: false, error: 'Cancel failed. Try again.' }
    } finally {
      this.pendingBets.delete(key)
    }
  }

  cashout(uid: string, slot = 0) {
    if (slot !== 0 && slot !== 1) return { ok: false, error: 'Invalid bet panel.' }
    if (this.phase !== 'FLYING') {
      return { ok: false, error: 'No flight in progress.' }
    }
    const e = this.entries.get(`${uid}:${slot}`)
    if (!e || e.isBot || e.status !== 'ACTIVE') {
      return { ok: false, error: 'No active bet to cash out.' }
    }
    const m = floor2(multiplierAt(Date.now() - this.startedAt))
    const eff = Math.min(e.personalCrash, this.globalCrash)
    if (m >= eff) {
      return { ok: false, error: 'Too late — the plane flew away!' }
    }
    this.resolveCashout(e, m)
    return { ok: true }
  }

  // ---------------- chat ----------------

  pushChat(msg: ChatMsg) {
    this.chatHistory.push(msg)
    if (this.chatHistory.length > 80) this.chatHistory.shift()
    this.io.emit('chat:message', msg)
  }

  systemChat(text: string) {
    this.pushChat({ id: msgId(), name: '99win', hue: 350, text, ts: Date.now(), kind: 'system' })
  }

  userChat(uid: string, name: string, hue: number, text: string): { ok: boolean; error?: string } {
    const clean = String(text || '').trim().slice(0, 180)
    if (!clean) return { ok: false, error: 'Empty message.' }
    const now = Date.now()
    const last = this.chatLastAt.get(uid) || 0
    if (now - last < 1500) return { ok: false, error: 'You are sending messages too fast.' }
    this.chatLastAt.set(uid, now)
    this.pushChat({ id: msgId(), name, hue, text: clean, ts: now, kind: 'user' })
    return { ok: true }
  }

  private startChatLoop() {
    const loop = () => {
      const delay =
        CONFIG.CHAT_MIN_INTERVAL_MS +
        Math.random() * (CONFIG.CHAT_MAX_INTERVAL_MS - CONFIG.CHAT_MIN_INTERVAL_MS)
      setTimeout(() => {
        const bots = pickRandomBots(1, 1)
        const b = bots[0]
        if (b) {
          let text: string
          if (this.phase === 'WAITING') {
            text = Math.random() < 0.35 ? pick(CHAT_WAITING) : pick(CHAT_GENERAL)
          } else {
            text = pick(CHAT_GENERAL)
          }
          this.pushChat({ id: msgId(), name: b.name, hue: b.hue, text, ts: Date.now(), kind: 'bot' })
        }
        loop()
      }, delay)
    }
    loop()
  }

  private startPresenceLoop() {
    setInterval(() => {
      const drift = Math.floor(Math.random() * 13) - 6
      this.fakeOnline = Math.max(
        CONFIG.FAKE_PRESENCE_BASE - 40,
        Math.min(CONFIG.FAKE_PRESENCE_BASE + CONFIG.FAKE_PRESENCE_SPREAD, this.fakeOnline + drift)
      )
      this.io.emit('presence:update', {
        online: this.fakeOnline + this.io.sockets.sockets.size,
      })
    }, 5000)
    this.startChatLoop()
  }
}
