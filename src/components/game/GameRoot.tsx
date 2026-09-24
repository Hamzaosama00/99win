'use client'

import { useEffect, useRef } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { getSocket, closeSocket, emitTick } from '@/lib/socket'
import { api, getToken, setToken } from '@/lib/api'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { authLoading, setAuth, clearAuth, patchWallet } from '@/store/slices/authSlice'
import {
  setConnected, setPresence, applyState, gameWaiting, gameStarted, gameEnded,
  betsAdd, betsUpdate, betsRemove, myBetResolved, setLeaderboard, betCancelled,
} from '@/store/slices/gameSlice'
import { chatMessage, chatHistory } from '@/store/slices/chatSlice'
import { PlaneTakeoffIcon } from '@/components/game/icons'
import type { ChatMsg } from '@/lib/types'
import { formatMoney } from '@/lib/money'
import AuthScreen from './AuthScreen'
import Header from './Header'
import RoundHistoryBar from './RoundHistoryBar'
import GameCanvas from './GameCanvas'
import BetPanel from './BetPanel'
import BetsTabs from './BetsTabs'
import ChatPanel, { ChatMobile } from './ChatPanel'
import DepositModal from './DepositModal'
import WithdrawModal from './WithdrawModal'
import WalletModal from './WalletModal'
import AdminPanel from './AdminPanel'
import SignalsApp from './SignalsApp'
import { setView as dispatchSetView } from '@/store/slices/uiSlice'

export default function GameRoot() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const user = useAppSelector((s) => s.auth.user)
  const view = useAppSelector((s) => s.ui.view)
  const bootRef = useRef(false)

  // ---- bootstrap session ----
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    // deep-link support (?view=signals) — used by the Signals PWA start_url
    const v = new URLSearchParams(window.location.search).get('view')
    if (v === 'signals' || v === 'admin') dispatch(dispatchSetView(v))
    dispatch(authLoading())
    const saved = getToken()
    if (!saved) {
      dispatch(clearAuth())
      return
    }
    api<{ user: any }>('/api/auth/me')
      .then((d) => dispatch(setAuth({ user: d.user, token: saved })))
      .catch(() => {
        setToken(null)
        dispatch(clearAuth())
      })
  }, [dispatch])

  // ---- socket lifecycle ----
  useEffect(() => {
    if (!token || !user) return
    const socket = getSocket(token)

    const onConnect = () => {
      dispatch(setConnected(true))
      socket.emit('wallet:sync')
    }
    const onDisconnect = () => dispatch(setConnected(false))

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('game:state', (s: any) => {
      dispatch(setConnected(true))
      dispatch(applyState(s))
    })
    socket.on('game:waiting', (d: any) =>
      dispatch(gameWaiting({ roundId: d.roundId, endsAt: d.endsAt, history: d.history }))
    )
    socket.on('game:started', (d: any) =>
      dispatch(gameStarted({ roundId: d.roundId, startedAt: d.startedAt }))
    )
    socket.on('game:ended', (d: any) =>
      dispatch(gameEnded({ roundId: d.roundId, crashPoint: d.crashPoint }))
    )
    socket.on('game:tick', (d: any) => emitTick(d.tMs, d.m))
    socket.on('bets:add', (d: any) => dispatch(betsAdd(d)))
    socket.on('bets:update', (d: any) => dispatch(betsUpdate(d)))
    socket.on('bets:remove', (d: any) => dispatch(betsRemove(d.betId)))
    socket.on('leaderboard:update', (d: any) => dispatch(setLeaderboard(d.leaderboard)))
    socket.on('presence:update', (d: any) => dispatch(setPresence(d.online)))

    socket.on('wallet:update', (d: any) => dispatch(patchWallet(d)))

    socket.on('bet:accepted', (d: any) => {
      // my bet is already in the list via the server's `bets:add` broadcast;
      // here we only track it as "my bet" and sync the debited balance
      if (typeof d.balance === 'number')
        dispatch(patchWallet({ balance: d.balance }))
    })
    socket.on('bet:cancelled', (d: any) => {
      dispatch(betCancelled())
      if (typeof d?.balance === 'number') dispatch(patchWallet({ balance: d.balance }))
    })
    socket.on('bet:error', (d: any) => toast.error(d?.message || 'Bet failed'))

    socket.on('game:user_cashed_out', (d: any) => {
      dispatch(myBetResolved({ status: 'WON', cashoutM: d.multiplier, win: d.win }))
      if (typeof d.balance === 'number') dispatch(patchWallet({ balance: d.balance }))
      toast.success(`Cashed out at ${d.multiplier.toFixed(2)}x — you won ${formatMoney(d.win, 2)}!`, {
        description: 'Winnings credited to your wallet.',
      })
    })
    socket.on('game:user_crashed', (d: any) => {
      dispatch(myBetResolved({ status: 'LOST' }))
      toast.error(`Flew away at ${d.crashPoint.toFixed(2)}x — lost ${formatMoney(d.loss, 2)}`)
    })

    socket.on('chat:history', (d: any) => dispatch(chatHistory(d.messages as ChatMsg[])))
    socket.on('chat:message', (d: any) => dispatch(chatMessage(d as ChatMsg)))
    socket.on('chat:error', (d: any) => toast.error(d?.message || 'Chat error'))

    socket.on('game:win_feed', (d: any) => {
      toast(`${d.name} won ${formatMoney(d.win)} at ${d.multiplier.toFixed(2)}x`, {
        description: (
          <span className="flex items-center gap-1.5">
            <PlaneTakeoffIcon className="h-4 w-4 text-primary" />
            Big win on the table!
          </span>
        ),
        duration: 4000,
      })
    })

    if (socket.connected) onConnect()

    return () => {
      socket.removeAllListeners()
      closeSocket()
      dispatch(setConnected(false))
    }
  }, [token, user, dispatch])

  if (!user) return <AuthScreen />

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        toastOptions={{ style: { fontFamily: 'var(--font-geist-sans)' } }}
      />
      {view === 'admin' ? (
        <AdminPanel />
      ) : view === 'signals' ? (
        <>
          <Toaster
            position="top-center"
            theme="dark"
            richColors
            toastOptions={{ style: { fontFamily: 'var(--font-geist-sans)' } }}
          />
          <SignalsApp />
        </>
      ) : (
        <>
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-2 sm:px-4 py-3 flex flex-col gap-3">
            <RoundHistoryBar />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-3 items-start">
              <div className="flex flex-col gap-3 min-w-0">
                <GameCanvas />
                <BetPanel />
                <BetsTabs />
              </div>
              <div className="hidden lg:flex flex-col gap-3 sticky top-[76px]">
                <ChatPanel />
              </div>
            </div>
          </main>
          <ChatMobile />
          <DepositModal />
          <WithdrawModal />
          <WalletModal />
          <footer className="mt-auto border-t border-border/60 py-3 text-center text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/70">99win</span> · Real-time
            crash game demo · Payments simulated for demonstration · 18+ Play responsibly
          </footer>
        </>
      )}
    </div>
  )
}
