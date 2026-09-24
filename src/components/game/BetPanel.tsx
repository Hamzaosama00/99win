'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plane, X, TrendingUp, Loader2 } from 'lucide-react'
import { CheckIcon, XIcon } from '@/components/game/icons'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import { getToken } from '@/lib/api'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { formatMoney, MIN_BET, MAX_BET } from '@/lib/money'
import { useLiveMultiplier } from './useLiveMultiplier'

const CHIPS = [16, 50, 100, 500, 1000]

export default function BetPanel() {
  const phase = useAppSelector((s) => s.game.phase)
  const myBet = useAppSelector((s) => s.game.myBet)
  const connected = useAppSelector((s) => s.game.connected)

  const [amount, setAmount] = useState<number>(16)
  const [autoOn, setAutoOn] = useState(false)
  const [autoVal, setAutoVal] = useState<number>(2)
  const [busy, setBusy] = useState(false)

  const liveM = useLiveMultiplier(phase === 'FLYING')

  const activeBet = myBet && myBet.status === 'ACTIVE' ? myBet : null
  const canBet = phase === 'WAITING' && !activeBet
  const canCancel = phase === 'WAITING' && !!activeBet
  const canCashout = phase === 'FLYING' && !!activeBet

  function emit(event: string, payload?: any) {
    const socket = getSocket(getToken())
    socket.emit(event, payload)
  }

  function clampAmount(v: number): number {
    return Math.max(MIN_BET, Math.min(MAX_BET, Math.round(v || 0)))
  }

  async function placeBet() {
    if (busy) return
    const amt = clampAmount(amount)
    setAmount(amt)
    const auto = autoOn ? Math.max(1.01, Math.min(100, autoVal)) : null
    setBusy(true)
    try {
      // optimistic: server confirms with bet:accepted
      emit('game:bet', { amount: amt, autoCashout: auto })
      // wait a beat for the accept/error round-trip to avoid double clicks
      await new Promise((r) => setTimeout(r, 350))
    } finally {
      setBusy(false)
    }
  }

  function cancelBet() {
    emit('game:cancel')
  }

  function cashout() {
    emit('game:cashout')
  }

  const liveWin = activeBet ? Math.floor(activeBet.amount * liveM * 100) / 100 : 0

  return (
    <Card className="border-border/80">
      <CardContent className="p-4 space-y-1">
        <div className="flex gap-3 items-stretch">
          {/* amount + chips + auto cashout */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Bet amount (PKR {MIN_BET} min)
                </Label>
                {activeBet && (
                  <span className="text-xs font-semibold text-gold font-tabular">
                    In play: {formatMoney(activeBet.amount)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  PKR
                </span>
                <Input
                  inputMode="numeric"
                  className="pl-12 font-bold font-tabular"
                  value={amount}
                  disabled={!!activeBet}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10)
                    setAmount(v)
                  }}
                  onBlur={() => setAmount(clampAmount(amount))}
                />
              </div>
            </div>

            <div className="flex gap-1.5">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  disabled={!!activeBet}
                  onClick={() => setAmount(c)}
                  className={cn(
                    'h-8 flex-1 rounded-lg text-[10px] sm:text-xs font-bold font-tabular border transition-colors disabled:opacity-40',
                    amount === c
                      ? 'bg-primary/15 border-primary/50 text-primary'
                      : 'bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  PKR {c}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                <Label className="text-xs">Auto cash out</Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={autoVal}
                  disabled={!autoOn || !!activeBet}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0')
                    setAutoVal(v)
                  }}
                  onBlur={() => setAutoVal(Math.max(1.01, Math.min(100, autoVal || 2)))}
                  className="h-8 w-20 text-right font-tabular text-xs"
                />
                <Switch checked={autoOn} onCheckedChange={setAutoOn} disabled={!!activeBet} />
              </div>
            </div>
          </div>

          {/* action button — sits to the right of the bet amount */}
          <div className="w-[122px] sm:w-[170px] shrink-0">
            <AnimatePresence mode="wait" initial={false}>
              {canCashout ? (
                <motion.div key="cashout" {...swap} className="h-full">
                  <Button
                    onClick={cashout}
                    className="w-full h-full min-h-[124px] rounded-xl bg-[#ff7a00] hover:bg-[#ff8d26] text-white font-black text-lg flex-col gap-0.5 animate-glow-pulse"
                  >
                    <span>CASH OUT</span>
                    <span className="text-xl font-tabular">{formatMoney(liveWin, 2)}</span>
                  </Button>
                </motion.div>
              ) : canCancel ? (
                <motion.div key="cancel" {...swap} className="h-full">
                  <Button
                    onClick={cancelBet}
                    variant="outline"
                    className="w-full h-full min-h-[124px] rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 font-black text-base flex-col gap-0.5"
                  >
                    <X className="h-5 w-5" />
                    CANCEL BET
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      waiting for takeoff…
                    </span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="bet" {...swap} className="h-full">
                  <Button
                    onClick={placeBet}
                    disabled={!canBet || busy || !connected}
                    className={cn(
                      'w-full h-full min-h-[124px] rounded-xl font-black text-lg flex-col gap-0.5 px-2',
                      canBet
                        ? 'bg-green-600 hover:bg-green-500 text-white btn-shine'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <Plane className="h-5 w-5 -rotate-45" />
                        BET
                        <span className="font-tabular text-base sm:text-lg">
                          {formatMoney(clampAmount(amount))}
                        </span>
                        {!canBet && (
                          <span className="text-[10px] font-medium normal-case leading-tight">
                            {phase === 'FLYING' || phase === 'ENDED'
                              ? 'wait for next round'
                              : !connected
                                ? 'connecting…'
                                : 'bet in play'}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* my bet result */}
        <div className="h-9 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {myBet && myBet.status === 'WON' && (
              <motion.span
                key="won"
                {...swap}
                className="text-sm font-bold text-green-500 font-tabular"
              >
                <CheckIcon className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" />
                Won {formatMoney(myBet.win ?? 0, 2)} @ {myBet.cashoutM?.toFixed(2)}x
              </motion.span>
            )}
            {myBet && myBet.status === 'LOST' && (
              <motion.span key="lost" {...swap} className="text-sm font-bold text-[#ff4d6d] font-tabular">
                <XIcon className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" />
                Flew away — {formatMoney(myBet.amount)} lost
              </motion.span>
            )}
            {myBet && myBet.status === 'ACTIVE' && myBet.autoCashout && (
              <motion.span
                key="auto"
                {...swap}
                className="text-xs text-muted-foreground"
              >
                Auto cash out @ {myBet.autoCashout.toFixed(2)}x
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

const swap = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.94 },
  transition: { duration: 0.14 },
}
