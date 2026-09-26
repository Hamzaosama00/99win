'use client'

import { useEffect, useState } from 'react'
import { Banknote, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { closeModal, openModal } from '@/store/slices/uiSlice'
import { patchWallet } from '@/store/slices/authSlice'
import { api } from '@/lib/api'
import { formatMoney, MIN_WITHDRAW } from '@/lib/money'

export default function WithdrawModal() {
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.ui.modal === 'withdraw')
  const user = useAppSelector((s) => s.auth.user)
  const [amount, setAmount] = useState<number>(500)
  const [account, setAccount] = useState('')
  const [busy, setBusy] = useState(false)
  const [eligible, setEligible] = useState<boolean | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setEligible(null)
    api<{ eligible: boolean }>('/api/wallet/withdraw')
      .then(data => { if (!cancelled) setEligible(data.eligible) })
      .catch(error => { if (!cancelled) { setEligible(false); toast.error(error.message) } })
    return () => { cancelled = true }
  }, [open])

  async function submit() {
    if (busy || !eligible) return
    if (!amount || amount < MIN_WITHDRAW) {
      toast.error(`Minimum withdrawal is PKR ${MIN_WITHDRAW}.`)
      return
    }
    if (!/^[0-9]{10,15}$/.test(account)) {
      toast.error('Enter your valid Easypaisa account number.')
      return
    }
    setBusy(true)
    try {
      const d = await api<{ user: any }>('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, account, method: 'Easypaisa' }),
      })
      dispatch(patchWallet({ balance: d.user.balance }))
      toast.success('Withdrawal requested — pending admin approval.')
      dispatch(closeModal())
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
        if (!o) dispatch(closeModal())
      }}
    >
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-gold" /> Withdraw Funds
          </DialogTitle>
          <DialogDescription>
            Manual payout to your Easypaisa account after admin approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
            At least one approved deposit is required before your first withdrawal.
            Pending or rejected deposits do not qualify.
            <button className="mt-2 block text-green-400 underline" onClick={() => dispatch(openModal('deposit'))}>
              Make a deposit
            </button>
          </div>
          <div className="rounded-xl bg-secondary/60 border border-border p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available balance</span>
            <span className="font-black text-gold font-tabular">
              {formatMoney(user?.balance ?? 0, 2)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Amount (min PKR {MIN_WITHDRAW})</Label>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) =>
                setAmount(parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10))
              }
              className="font-bold font-tabular"
            />
            <div className="flex gap-1.5 pt-1">
              {[500, 1000, 2000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className="h-7 flex-1 rounded-lg text-xs font-bold bg-secondary border border-border hover:bg-accent"
                >
                  PKR {v}
                </button>
              ))}
              <button
                onClick={() => setAmount(Math.floor(user?.balance ?? 0))}
                className="h-7 flex-1 rounded-lg text-xs font-bold bg-secondary border border-border hover:bg-accent"
              >
                ALL
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Easypaisa account number</Label>
            <Input
              inputMode="numeric"
              placeholder="03XX XXXXXXX"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/[^0-9]/g, ''))}
              className="font-mono"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-gold/10 border border-gold/25 px-3 py-2 text-[11px] text-gold">
            <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            The amount is held from your balance immediately and paid out after
            the admin approves (usually 10–30 minutes). Rejected requests are
            refunded automatically.
          </div>

          <Button
            onClick={submit}
            disabled={busy || !eligible || (user?.balance ?? 0) < amount}
            className="w-full h-11 font-bold btn-shine"
          >
            {busy || eligible === null ? <Loader2 className="h-4 w-4 animate-spin" /> : eligible ? 'Request Withdrawal' : 'Approved deposit required'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
