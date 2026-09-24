'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * External game-server URL (wss://…). Leave empty to use the local gateway
 * (sandbox/Caddy routes via XTransformPort). For Vercel deployments set
 * NEXT_PUBLIC_GAME_SERVER_URL to your hosted game service (see README-DEPLOY.md).
 */
const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || ''

/**
 * Connects to the 99win game service.
 * NEVER use a port in the URL — Caddy routes via XTransformPort.
 */
export function getSocket(token: string | null): Socket {
  if (socket && socket.connected) return socket
  socket?.disconnect()
  socket = io(GAME_SERVER_URL || '/?XTransformPort=3003', {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    auth: { token },
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    timeout: 10000,
  })
  return socket
}

export function closeSocket() {
  socket?.disconnect()
  socket = null
}

// ---- multiplier tick pub-sub (kept out of Redux for 60fps smoothness) ----

type TickFn = (tMs: number, m: number) => void
const tickSubs = new Set<TickFn>()

export function onTick(fn: TickFn): () => void {
  tickSubs.add(fn)
  return () => {
    tickSubs.delete(fn)
  }
}

export function emitTick(tMs: number, m: number) {
  tickSubs.forEach((f) => {
    try {
      f(tMs, m)
    } catch {}
  })
}

/** Matches mini-services/game-service/config.ts */
export const GROWTH_RATE = 0.15

/** multiplier at elapsed ms */
export function multiplierAt(elapsedMs: number): number {
  return Math.exp((GROWTH_RATE * Math.max(0, elapsedMs)) / 1000)
}
