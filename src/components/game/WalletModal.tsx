'use client'

import { useEffect } from 'react'
import { Wallet, Plus, Minus, RefreshCcw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { closeModal, openModal, setTransactions } from '@/store/slices/uiSlice'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Tx } from '@/lib/types'

function statusBadge(s: string) {
  switch (s) {
    case 'PENDING':
      return 'bg-gold/15 text-gold border-gold/30'
    case 'APPROVED':
    case 'COMPLETED':
      return 'bg-green-600/15 text-green-500 border-green-600/30'
    case 'REJECTED':
      return 'bg-destructive/15 text-destructive border-destructive/30'
    default:
      return 'bg-secondary text-muted-foreground border-border'
  }
}

export default function WalletModal() {
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.ui.modal === 'wallet')
  const user = useAppSelector((s) => s.auth.user)
  const transactions = useAppSelector((s) => s.ui.transactions)

  useEffect(() => {
    if (!open || !user) return
    api<{ transactions: Tx[] }>('/api/wallet/transactions')
      .then((d) => dispatch(setTransactions(d.transactions)))
      .catch(() => {})
  }, [open, user, dispatch])

  const stats = [
    { label: 'Balance', value: user?.balance ?? 0, cls: 'text-gold' },
    { label: 'Total Deposit', value: user?.totalDeposit ?? 0, cls: 'text-foreground' },
    { label: 'Total Win', value: user?.totalWin ?? 0, cls: 'text-green-500' },
    { label: 'Total Loss', value: user?.totalLoss ?? 0, cls: 'text-destructive' },
    { label: 'Cashback Earned', value: user?.cashbackEarned ?? 0, cls: 'text-gold' },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) dispatch(closeModal())
      }}
    >
      <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gold" /> My Wallet
          </DialogTitle>
          <DialogDescription>
            {user?.name} · {user?.phone.replace(/(\d{4})\d+(\d{3})/, '$1****$2')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'rounded-xl bg-secondary/50 border border-border p-3',
                i === 0 && 'col-span-2 bg-gold/5 border-gold/25'
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className={cn('text-lg font-black font-tabular', s.cls)}>
                {formatMoney(s.value, 2)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => dispatch(openModal('deposit'))}
            className="h-10 font-bold bg-green-600 hover:bg-green-500"
          >
            <Plus className="h-4 w-4 mr-1" /> Deposit
          </Button>
          <Button
            onClick={() => dispatch(openModal('withdraw'))}
            variant="secondary"
            className="h-10 font-bold"
          >
            <Minus className="h-4 w-4 mr-1" /> Withdraw
          </Button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Transactions
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground"
              onClick={() => {
                api<{ transactions: Tx[] }>('/api/wallet/transactions')
                  .then((d) => dispatch(setTransactions(d.transactions)))
                  .catch(() => {})
              }}
            >
              <RefreshCcw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {transactions.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No transactions yet.
              </p>
            )}
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg bg-secondary/40 border border-border/60 px-2.5 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">
                      {t.type === 'DEPOSIT'
                        ? 'Deposit'
                        : t.type === 'WITHDRAW'
                          ? 'Withdrawal'
                          : t.type === 'CASHBACK'
                            ? 'Cashback'
                            : 'Bonus'}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase rounded border px-1 py-px',
                        statusBadge(t.status)
                      )}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {new Date(t.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {t.txnId ? ` · TID ${t.txnId}` : ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-sm font-black font-tabular',
                    t.type === 'DEPOSIT' || t.type === 'CASHBACK' || t.type === 'BONUS'
                      ? 'text-green-500'
                      : 'text-destructive'
                  )}
                >
                  {t.type === 'DEPOSIT' || t.type === 'CASHBACK' || t.type === 'BONUS'
                    ? '+'
                    : '−'}
                  {formatMoney(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
