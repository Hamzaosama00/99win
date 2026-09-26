'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Loader2 } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { getToken } from '@/lib/api'
import { useAppSelector } from '@/store/store'
import { MIN_BET, MAX_BET } from '@/lib/money'
import { useLiveMultiplier } from './useLiveMultiplier'

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export default function BetPanel({ slot }: { slot: number }) {
  const phase = useAppSelector(s => s.game.phase)
  const bet = useAppSelector(s => s.game.myBets.find(b => b.slot === slot))
  const connected = useAppSelector(s => s.game.connected)
  const [amount, setAmount] = useState('16.00')
  const [auto, setAuto] = useState(false)
  const [target, setTarget] = useState('2.00')
  const [busy, setBusy] = useState(false)
  const multiplier = useLiveMultiplier(phase === 'FLYING')
  const active = bet?.status === 'ACTIVE'
  const cashout = active && phase === 'FLYING'
  const cancel = active && phase === 'WAITING'
  const clamp = (v: number) => Math.max(MIN_BET, Math.min(MAX_BET, Math.round(v || MIN_BET)))
  const value = clamp(Number(amount))

  useEffect(() => {
    if (!connected) { setBusy(false); return }
    const socket = getSocket(getToken())
    const done = (data: { slot?: number }) => { if ((data.slot ?? 0) === slot) setBusy(false) }
    socket.on('bet:accepted', done); socket.on('bet:cancelled', done); socket.on('bet:error', done)
    return () => { socket.off('bet:accepted', done); socket.off('bet:cancelled', done); socket.off('bet:error', done) }
  }, [connected, slot])
  useEffect(() => { setBusy(false) }, [phase, bet?.status])

  function act() {
    if (!connected || busy) return
    const socket = getSocket(getToken())
    if (cashout) { socket.emit('game:cashout', { slot }); return }
    if (cancel) { setBusy(true); socket.emit('game:cancel', { slot }); return }
    if (phase !== 'WAITING' || bet) return
    setAmount(value.toFixed(2)); setBusy(true)
    socket.emit('game:bet', { slot, amount: value, autoCashout: auto ? Math.max(1.01, Math.min(100, Number(target) || 2)) : null })
  }

  return <section className="bet-control" aria-label={`Bet panel ${slot + 1}`}>
    <div className="bet-mode" role="group" aria-label={`Bet ${slot + 1} mode`}>
      <button aria-pressed={!auto} className={!auto ? 'selected' : ''} disabled={!!bet || busy} onClick={() => setAuto(false)}>Bet</button>
      <button aria-pressed={auto} className={auto ? 'selected' : ''} disabled={!!bet || busy} onClick={() => setAuto(true)}>Auto</button>
    </div>
    <div className="auto-target">
      {auto && <label>Auto cash out <input aria-label={`Auto cash out multiplier ${slot + 1}`} type="number" min="1.01" max="100" step="0.01" value={target} disabled={!!bet || busy} onChange={e => setTarget(e.target.value)} /> x</label>}
    </div>
    <div className="bet-inputs">
      <div className="bet-amounts">
        <div className="amount-stepper">
          <button aria-label={`Decrease bet ${slot + 1}`} disabled={!!bet || busy} onClick={() => setAmount(clamp(value - 16).toFixed(2))}><Minus size={18} /></button>
          <input aria-label={`Bet amount ${slot + 1} in PKR`} inputMode="decimal" value={amount} disabled={!!bet || busy} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => setAmount(value.toFixed(2))} />
          <button aria-label={`Increase bet ${slot + 1}`} disabled={!!bet || busy} onClick={() => setAmount(clamp(value + 16).toFixed(2))}><Plus size={18} /></button>
        </div>
        <div className="amount-presets">{[64, 160, 320, 1600].map(n => <button key={n} disabled={!!bet || busy} onClick={() => setAmount(n.toFixed(2))}>{n.toLocaleString('en-US')}</button>)}</div>
      </div>
      <button className={`bet-action ${cashout ? 'cashout' : cancel ? 'cancel' : ''}`} disabled={!connected || busy || (!active && (phase !== 'WAITING' || !!bet))} onClick={act}>
        {busy ? <Loader2 className="animate-spin mx-auto" /> : <><span>{cashout ? 'Cash Out' : cancel ? 'Cancel' : 'Bet'}</span><span>{money(cashout ? Math.floor((bet?.amount ?? 0) * multiplier * 100) / 100 : bet?.amount ?? value)}<small> PKR</small></span></>}
      </button>
    </div>
    <div className="bet-result" aria-live="polite">{!connected ? 'Connecting…' : bet?.status === 'WON' ? `Won ${money(bet.win ?? 0)} PKR at ${bet.cashoutM?.toFixed(2)}x` : bet?.status === 'LOST' ? 'Flew away — wait for the next round' : !active && phase !== 'WAITING' ? 'Wait for the next round' : ''}</div>
  </section>
}
