'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Lock, Copy, ShieldCheck, QrCode, ChevronLeft, Loader2,
  BadgeCheck, Smartphone, Download, Globe, Languages,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { closeModal } from '@/store/slices/uiSlice'
import { api } from '@/lib/api'
import { DEPOSIT_PRESETS, cashbackPercent, cashbackAmount, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Deterministic decorative QR placeholder (simulated payment — no real QR). */
function FakeQR({ seed, size = 148 }: { seed: string; size?: number }) {
  const cells = 21
  const bits = useMemo(() => {
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const arr: boolean[] = []
    let x = h >>> 0
    for (let i = 0; i < cells * cells; i++) {
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      x >>>= 0
      arr.push((x & 1) === 1)
    }
    return arr
  }, [seed])

  const isFinder = (r: number, c: number) => {
    const inBox = (r0: number, c0: number) =>
      r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7
    return inBox(0, 0) || inBox(0, cells - 7) || inBox(cells - 7, 0)
  }
  const finderFill = (r: number, c: number) => {
    const boxes: Array<[number, number]> = [[0, 0], [0, cells - 7], [cells - 7, 0]]
    for (const [r0, c0] of boxes) {
      if (r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7) {
        const rr = r - r0
        const cc = c - c0
        const ring = Math.max(Math.abs(rr - 3), Math.abs(cc - 3))
        return ring === 3 || ring <= 1
      }
    }
    return false
  }

  const unit = size / cells
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
      <rect width={size} height={size} fill="white" />
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((__, c) => {
          if (isFinder(r, c) && !finderFill(r, c)) return null
          const on = isFinder(r, c) ? finderFill(r, c) : bits[r * cells + c]
          if (!on) return null
          return (
            <rect
              key={`${r}-${c}`}
              x={c * unit}
              y={r * unit}
              width={unit}
              height={unit}
              fill="#0a0c10"
            />
          )
        })
      )}
    </svg>
  )
}

export default function DepositModal() {
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.ui.modal === 'deposit')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [amount, setAmount] = useState<number>(1000)
  const [custom, setCustom] = useState('')
  const [txnId, setTxnId] = useState('')
  const [busy, setBusy] = useState(false)
  const qrBoxRef = useRef<HTMLDivElement>(null)

  const merchant = {
    name: '99WIN OFFICIAL',
    phone: '03459988721',
    phoneMasked: '0345•••••721',
    iban: 'PK24HABB0000045178991003',
    ibanMasked: 'PK24 •••• •••• •••• 8991003',
  }

  const amt = custom ? parseInt(custom.replace(/[^0-9]/g, '') || '0', 10) : amount
  const cbPct = cashbackPercent(amt || 0)
  const cbAmt = cashbackAmount(amt || 0)

  function reset() {
    setStep(1)
    setTxnId('')
    setCustom('')
  }

  /** Serialize the QR SVG → PNG and download it for Easypaisa gallery scanning. */
  async function downloadQR() {
    const svg = qrBoxRef.current?.querySelector('svg')
    if (!svg) return
    try {
      const xml = new XMLSerializer().serializeToString(svg)
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('render failed'))
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
      })
      const size = 560
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 24, 24, size - 48, size - 48)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `99win-easypaisa-qr-${amt || 1000}.png`
      a.click()
      toast.success('QR code downloaded. Select it from your gallery inside Easypaisa.')
    } catch {
      toast.error('Could not download the QR. Please take a screenshot instead.')
    }
  }

  async function submit() {
    if (busy) return
    if (!txnId || txnId.trim().length < 6) {
      toast.error('Enter the Transaction ID (TID) from your Easypaisa receipt.')
      return
    }
    setBusy(true)
    try {
      await api('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: amt, txnId: txnId.trim(), method: 'Easypaisa' }),
      })
      setStep(3)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          dispatch(closeModal())
          setTimeout(reset, 200)
        }
      }}
    >
      <DialogContent className="max-w-lg bg-card border-border max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent"
                aria-label="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="flex items-center gap-2">
              {step === 3 ? (
                <>
                  <BadgeCheck className="h-5 w-5 text-green-500" /> Deposit Submitted
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-green-500" /> Secure Payment
                </>
              )}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1 && 'Choose a deposit amount — bigger deposits unlock bigger cashback.'}
            {step === 2 && 'Pay via Easypaisa, then enter your Transaction ID for verification.'}
            {step === 3 && 'Your deposit is now pending verification by our team.'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ---------------- STEP 1: amount ---------------- */}
          {step === 1 && (
            <motion.div key="s1" {...fade} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {DEPOSIT_PRESETS.map((v) => {
                  const pct = cashbackPercent(v)
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setAmount(v)
                        setCustom('')
                      }}
                      className={cn(
                        'relative rounded-xl border px-2 py-3 text-center transition-colors',
                        !custom && amount === v
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/50 hover:bg-accent'
                      )}
                    >
                      <div className="font-black font-tabular text-sm">{formatMoney(v)}</div>
                      {pct > 0 && (
                        <div className="mt-0.5 text-[10px] font-bold text-gold">
                          +{pct}% cashback
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Custom amount</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Enter amount (min PKR 100)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>

              <div className="rounded-xl bg-secondary/60 border border-border p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cashback on approval</span>
                <span className="font-bold text-gold font-tabular">
                  {cbPct > 0 ? `${formatMoney(cbAmt, 2)} (${cbPct}%)` : '—'}
                </span>
              </div>

              <Button
                disabled={!amt || amt < 100}
                onClick={() => setStep(2)}
                className="w-full h-11 font-bold btn-shine"
              >
                Continue — Pay {formatMoney(amt || 0)}
              </Button>
            </motion.div>
          )}

          {/* ---------------- STEP 2: payment ---------------- */}
          {step === 2 && (
            <motion.div key="s2" {...fade} className="space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div ref={qrBoxRef} className="rounded-xl bg-white p-2">
                    <FakeQR seed={`99win-${amt}-${merchant.phone}`} />
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                    <QrCode className="h-2.5 w-2.5" /> SCAN TO PAY
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={downloadQR}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download QR
                  </Button>
                </div>

                <div className="flex-1 min-w-0 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Amount</span>
                    <span className="font-black text-lg text-gold font-tabular">
                      {formatMoney(amt || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Merchant</span>
                    <span className="font-semibold text-xs">{merchant.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Easypaisa No.</span>
                    <span className="font-mono text-xs font-semibold">
                      {merchant.phoneMasked}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">IBAN</span>
                    <span className="flex items-center gap-1 font-mono text-xs font-semibold">
                      {merchant.ibanMasked}
                      <button
                        aria-label="Copy IBAN"
                        onClick={() =>
                          navigator.clipboard?.writeText(merchant.iban).then(() =>
                            toast.success('IBAN copied')
                          )
                        }
                      >
                        <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* English instructions */}
              <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-gold" /> How to pay (English)
                </p>
                <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                  <li>
                    <span className="font-semibold text-foreground">Download the QR code</span>{' '}
                    (button below the QR).
                  </li>
                  <li>
                    Open the <span className="font-semibold text-foreground">Easypaisa app</span> →
                    Click <span className="font-semibold text-foreground">Scanner</span> down below
                    and select the QR from gallery.
                  </li>
                  <li>
                    Send the exact amount of{' '}
                    <span className="font-bold text-gold">{formatMoney(amt || 0)}</span>.
                  </li>
                  <li>
                    Copy the <span className="font-semibold text-foreground">Transaction ID (TID)</span>{' '}
                    from your payment receipt.
                  </li>
                  <li>Paste the TID below and submit for verification.</li>
                </ol>
              </div>

              {/* Roman Urdu instructions */}
              <div className="rounded-xl bg-gold/5 border border-gold/20 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gold flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5" /> Tareeqa (Roman Urdu)
                </p>
                <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                  <li>
                    <span className="font-semibold text-foreground">QR code download karein</span>{' '}
                    (QR ke neeche wala button).
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Easypaisa app kholein</span> →
                    neeche <span className="font-semibold text-foreground">Scanner</span> par click
                    karein aur gallery se QR select karein.
                  </li>
                  <li>
                    Exactly <span className="font-bold text-gold">{formatMoney(amt || 0)}</span> ka
                    amount bhejein.
                  </li>
                  <li>
                    Payment receipt se{' '}
                    <span className="font-semibold text-foreground">Transaction ID (TID)</span> copy
                    karein.
                  </li>
                  <li>Neeche TID paste karein aur verification ke liye submit kar dein.</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> Transaction ID (TID)
                </Label>
                <Input
                  placeholder="e.g. 42881930275"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className="font-mono"
                />
              </div>

              <Button onClick={submit} disabled={busy} className="w-full h-11 font-bold btn-shine">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'I Have Paid — Submit'}
              </Button>

              <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                256-bit encrypted · Simulated gateway for demo
              </p>
            </motion.div>
          )}

          {/* ---------------- STEP 3: pending ---------------- */}
          {step === 3 && (
            <motion.div key="s3" {...fade} className="space-y-4 py-2 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-600/15 flex items-center justify-center">
                <BadgeCheck className="h-9 w-9 text-green-500" />
              </div>
              <div className="space-y-1">
                <p className="font-bold">{formatMoney(amt || 0)} under review</p>
                <p className="text-xs text-muted-foreground">
                  Funds will be credited automatically once the admin verifies your
                  transaction — usually within 5–10 minutes. Cashback (
                  {cbPct}%) applies on approval.
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 border border-border p-3 text-xs font-mono break-all">
                TID: {txnId}
              </div>
              <Button
                onClick={() => {
                  dispatch(closeModal())
                  setTimeout(reset, 200)
                }}
                variant="secondary"
                className="w-full h-10 font-semibold"
              >
                Done — Track status in Wallet
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

const fade = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.18 },
}
