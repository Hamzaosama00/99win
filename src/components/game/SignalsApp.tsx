'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Radar, Target, Ban, Smartphone, Share2, RefreshCcw,
  TrendingUp, CircleCheck, XCircle, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { setView } from '@/store/slices/uiSlice'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------- types ----------------

interface SignalRow {
  roundId: number
  eff: number
  verdict: 'STRONG_BET' | 'SAFE_BET' | 'SKIP'
  target: number | null
  stake: number
  confidence: number
  relation: 'PAST' | 'LIVE' | 'NEXT'
  hit: boolean | null
}

interface SignalsPayload {
  serverTime: number
  engine: { roundId: number; phase: string; endsAt: number; startedAt: number }
  history: number[]
  rounds: SignalRow[]
}

const VERDICT_META: Record<SignalRow['verdict'], { label: string; cls: string; icon: any }> = {
  STRONG_BET: {
    label: 'STRONG BET',
    cls: 'bg-green-600 text-white border-green-500',
    icon: Target,
  },
  SAFE_BET: {
    label: 'SAFE BET',
    cls: 'bg-green-600/15 text-green-500 border-green-600/40',
    icon: Target,
  },
  SKIP: {
    label: 'SKIP ROUND',
    cls: 'bg-[#ff2d55]/15 text-[#ff2d55] border-[#ff2d55]/40',
    icon: Ban,
  },
}

/**
 * SignalsLive — the real-time signal feed. Polls /api/signals every 2s; the
 * next-round signal updates automatically the moment the engine rolls a round.
 */
export function SignalsLive({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<SignalsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await api<SignalsPayload>('/api/signals')
      setData(d)
      setErr(null)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 2000)
    return () => clearInterval(iv)
  }, [load])

  // local countdown while waiting
  useEffect(() => {
    if (!data || data.engine.phase !== 'WAITING') {
      setCountdown('')
      return
    }
    const iv = setInterval(() => {
      const remain = Math.max(0, (data.engine.endsAt ?? 0) - Date.now())
      setCountdown(`${(remain / 1000).toFixed(1)}s`)
    }, 100)
    return () => clearInterval(iv)
  }, [data])

  if (loading && !data) {
    return (
      <div className="py-14 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (err && !data) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-destructive">{err}</p>
        <Button size="sm" variant="secondary" onClick={load}>
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    )
  }

  // actionable signal = the round the user can currently bet on
  const action =
    data!.rounds.find((r) => r.relation === 'LIVE') ?? data!.rounds.find((r) => r.relation === 'NEXT')!
  const past = data!.rounds.filter((r) => r.relation === 'PAST').slice().reverse()
  const betsFollowed = past.filter((r) => r.verdict !== 'SKIP')
  const hits = betsFollowed.filter((r) => r.hit === true).length
  const accuracy = betsFollowed.length ? Math.round((hits / betsFollowed.length) * 100) : 100
  const meta = VERDICT_META[action.verdict]
  const bettingOpen = data!.engine.phase === 'WAITING' && action.relation === 'LIVE'

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {/* live round strip */}
      <div className="flex items-center justify-between rounded-xl bg-secondary/60 border border-border px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Radar className="h-3.5 w-3.5 text-primary animate-pulse" />
          Round <span className="font-mono font-bold text-foreground">#{data!.engine.roundId}</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'font-bold uppercase tracking-wide',
              data!.engine.phase === 'WAITING' ? 'text-green-500' : 'text-gold'
            )}
          >
            {data!.engine.phase === 'WAITING' ? 'Betting open' : 'In flight'}
          </span>
          {countdown && <span className="font-tabular font-bold text-foreground">{countdown}</span>}
        </span>
      </div>

      {/* THE signal card */}
      <Card className="border-gold/30 bg-gradient-to-b from-gold/10 to-transparent overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              {action.relation === 'LIVE' ? 'This round signal' : 'Next round signal'}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">#{action.roundId}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={action.roundId + action.verdict}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 flex items-center gap-3 font-black text-lg tracking-wide',
                  meta.cls
                )}
              >
                <meta.icon className="h-6 w-6 shrink-0" />
                {meta.label}
              </div>

              {action.target !== null ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-secondary/60 border border-border p-2.5">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Cash out at
                    </div>
                    <div className="text-lg font-black font-tabular text-gold">
                      {action.target.toFixed(2)}x
                    </div>
                  </div>
                  <div className="rounded-xl bg-secondary/60 border border-border p-2.5">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Stake
                    </div>
                    <div className="text-lg font-black font-tabular">
                      PKR {action.stake}
                    </div>
                  </div>
                  <div className="rounded-xl bg-secondary/60 border border-border p-2.5">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Confidence
                    </div>
                    <div className="text-lg font-black font-tabular text-green-500">
                      {action.confidence}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/60 border border-border p-3 text-xs text-muted-foreground text-center">
                  Engine projection is low for this round — save your balance and{' '}
                  <span className="font-bold text-[#ff2d55]">sit this one out</span>.
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {bettingOpen
                    ? countdown
                      ? `Place your bet — closes in ${countdown}`
                      : 'Place your bet now'
                    : 'Signal locked — bet when the next betting window opens'}
                </span>
                <span className="flex items-center gap-1">
                  <CircleCheck className="h-3 w-3 text-green-500" /> Auto cash out ready
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* accuracy */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-border/70">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Signal accuracy
            </div>
            <div className="text-xl font-black font-tabular text-green-500">{accuracy}%</div>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Rounds tracked
            </div>
            <div className="text-xl font-black font-tabular">{past.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* history */}
      <Card className="border-border/70">
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-gold" /> Signal history
          </div>
          <div className={cn('divide-y divide-border/60', compact ? 'max-h-56' : 'max-h-72', 'overflow-y-auto')}>
            {past.map((r) => {
              const vm = VERDICT_META[r.verdict]
              return (
                <div key={r.roundId} className="px-3 py-2 flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground w-14 shrink-0">
                    #{r.roundId}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-black rounded border px-1.5 py-px uppercase tracking-wide',
                      vm.cls
                    )}
                  >
                    {r.verdict === 'SKIP' ? 'SKIP' : r.verdict === 'SAFE_BET' ? 'SAFE' : 'STRONG'}
                  </span>
                  {r.target !== null && (
                    <span className="font-tabular text-gold font-bold">
                      @{r.target.toFixed(2)}x
                    </span>
                  )}
                  <span className="ml-auto font-tabular text-muted-foreground">
                    crashed {r.eff.toFixed(2)}x
                  </span>
                  {r.hit ? (
                    <CircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * SignalsApp — standalone installable PWA shell around SignalsLive.
 * Reachable via the Admin panel ("Signals App") or the header shortcut.
 */
export default function SignalsApp() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [installEvt, setInstallEvt] = useState<any>(null)

  // PWA: inject manifest + service worker registration for this view
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/manifest-signals.webmanifest'
    document.head.appendChild(link)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => {
      link.remove()
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  async function install() {
    if (!installEvt) {
      toast('Open your browser menu and tap "Add to Home Screen" to install.', {
        duration: 6000,
      })
      return
    }
    installEvt.prompt()
    const choice = await installEvt.userChoice
    if (choice?.outcome === 'accepted') toast.success('99win Signals installed!')
    setInstallEvt(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="max-w-md mx-auto px-3 h-[60px] flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => dispatch(setView('game'))}
            aria-label="Back to game"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <img src="/99win-logo.svg" alt="99win logo" className="h-9 w-9 rounded-xl" />
          <div className="leading-none">
            <h1 className="font-black">
              99<span className="text-gold">win</span> Signals
            </h1>
            <p className="text-[9px] tracking-[0.28em] uppercase text-muted-foreground">
              VIP Live Predictor
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={install}
              className="h-9 text-xs font-bold bg-gold text-black hover:bg-gold/85 gap-1.5"
            >
              <Smartphone className="h-3.5 w-3.5" /> Install App
            </Button>
            {user?.role === 'ADMIN' && (
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 lg:hidden"
                onClick={() => dispatch(setView('admin'))}
                aria-label="Admin panel"
              >
                <Share2 className="h-4 w-4 rotate-180" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-3 py-4">
        <SignalsLive />
        <p className="mt-4 text-center text-[10px] text-muted-foreground leading-relaxed px-2">
          Signals are generated by the 99win probability engine before each round
          and update automatically. Play responsibly — 18+.
        </p>
      </main>
    </div>
  )
}
