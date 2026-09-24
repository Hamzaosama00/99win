'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Users, Banknote, TrendingUp, Clock, ShieldCheck,
  Check, X, RefreshCcw, Plane, Loader2, Radar, Smartphone,
} from 'lucide-react'
import { CheckCircleIcon } from '@/components/game/icons'
import { SignalsLive } from './SignalsApp'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { setView, resetUser } from '@/store/slices/uiSlice'
import { clearAuth } from '@/store/slices/authSlice'
import { closeSocket } from '@/lib/socket'
import { api, setToken } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AdminStats, AdminUser, AdminTx } from '@/lib/types'

export default function AdminPanel() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminTx[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminTx[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, u, d, w] = await Promise.all([
        api<{ stats: AdminStats }>('/api/admin/stats'),
        api<{ users: AdminUser[] }>('/api/admin/users'),
        api<{ transactions: AdminTx[] }>(
          '/api/admin/transactions?status=PENDING&type=DEPOSIT'
        ),
        api<{ transactions: AdminTx[] }>(
          '/api/admin/transactions?status=PENDING&type=WITHDRAW'
        ),
      ])
      setStats(s.stats)
      setUsers(u.users)
      setDeposits(d.transactions)
      setWithdrawals(w.transactions)
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 12000)
    return () => clearInterval(iv)
  }, [refresh])

  async function review(txId: string, action: 'approve' | 'reject') {
    setBusyId(txId + action)
    try {
      await api(`/api/admin/transactions/${txId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      toast.success(action === 'approve' ? 'Approved — wallet updated.' : 'Rejected.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function logout() {
    setToken(null)
    closeSocket()
    dispatch(clearAuth())
    dispatch(resetUser())
  }

  const statCards = [
    { label: 'Users', value: String(stats?.users ?? '—'), icon: Users, cls: 'text-foreground' },
    {
      label: 'Total Deposited',
      value: stats ? formatMoney(stats.totalDeposited) : '—',
      icon: Banknote,
      cls: 'text-gold',
    },
    {
      label: 'House Profit',
      value: stats ? formatMoney(stats.houseProfit) : '—',
      icon: TrendingUp,
      cls: (stats?.houseProfit ?? 0) >= 0 ? 'text-green-500' : 'text-destructive',
    },
    {
      label: 'Pending Deposits',
      value: String(stats?.pendingDeposits ?? '—'),
      icon: Clock,
      cls: 'text-gold',
    },
    {
      label: 'Pending Withdrawals',
      value: String(stats?.pendingWithdrawals ?? '—'),
      icon: Clock,
      cls: 'text-gold',
    },
    {
      label: 'Wagered / Paid',
      value: stats ? `${formatMoney(stats.wagered)} / ${formatMoney(stats.paidOut)}` : '—',
      icon: Plane,
      cls: 'text-foreground',
    },
  ]

  function TxCard({ t, kind }: { t: AdminTx; kind: 'DEPOSIT' | 'WITHDRAW' }) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="rounded-xl border border-border bg-secondary/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg font-tabular text-gold">
              {formatMoney(t.amount)}
            </span>
            <span className="text-[10px] font-bold uppercase rounded border border-gold/30 bg-gold/10 text-gold px-1.5 py-px">
              {t.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{t.user?.name}</span> ·{' '}
            {t.user?.phone}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground/80 truncate">
            {kind === 'DEPOSIT'
              ? `TID: ${t.txnId ?? '—'}`
              : `Account: ${t.account ?? '—'}`}
            {' · '}
            {new Date(t.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => review(t.id, 'approve')}
            disabled={busyId === t.id + 'approve'}
            className="bg-green-600 hover:bg-green-500 font-bold"
          >
            {busyId === t.id + 'approve' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => review(t.id, 'reject')}
            disabled={busyId === t.id + 'reject'}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 font-bold"
          >
            {busyId === t.id + 'reject' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5 mr-1" />
            )}
            Reject
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* admin header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 h-[60px] flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={() => dispatch(setView('game'))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Game
          </Button>
          <h1 className="font-black flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            99win <span className="text-gold">Admin</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} className="h-9">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="h-9">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4">
        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {statCards.map((s) => (
            <Card key={s.label} className="border-border/70">
              <CardContent className="p-3">
                <s.icon className="h-4 w-4 text-muted-foreground mb-1.5" />
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className={cn('text-sm font-black font-tabular truncate', s.cls)}>
                  {s.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="deposits">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="deposits">
              Deposits
              {(stats?.pendingDeposits ?? 0) > 0 && (
                <span className="ml-1.5 text-[10px] rounded-full bg-gold text-black font-bold px-1.5">
                  {stats!.pendingDeposits}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals">
              Withdrawals
              {(stats?.pendingWithdrawals ?? 0) > 0 && (
                <span className="ml-1.5 text-[10px] rounded-full bg-gold text-black font-bold px-1.5">
                  {stats!.pendingWithdrawals}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="signals">
              <Radar className="h-3.5 w-3.5 mr-1 text-gold" />
              Signals App
            </TabsTrigger>
          </TabsList>

          {/* deposits */}
          <TabsContent value="deposits" className="mt-3">
            <div className="space-y-2 min-h-[200px]">
              <AnimatePresence>
                {deposits.length === 0 && (
                  <p className="py-14 text-center text-sm text-muted-foreground">
                    No pending deposits — all caught up{' '}
                    <CheckCircleIcon className="inline h-4 w-4 -mt-0.5 text-green-500" />
                  </p>
                )}
                {deposits.map((t) => (
                  <TxCard key={t.id} t={t} kind="DEPOSIT" />
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* withdrawals */}
          <TabsContent value="withdrawals" className="mt-3">
            <div className="space-y-2 min-h-[200px]">
              <AnimatePresence>
                {withdrawals.length === 0 && (
                  <p className="py-14 text-center text-sm text-muted-foreground">
                    No pending withdrawals{' '}
                    <CheckCircleIcon className="inline h-4 w-4 -mt-0.5 text-green-500" />
                  </p>
                )}
                {withdrawals.map((t) => (
                  <TxCard key={t.id} t={t} kind="WITHDRAW" />
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* signals app */}
          <TabsContent value="signals" className="mt-3">
            <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
              <Card className="border-gold/30 bg-gradient-to-b from-gold/10 to-transparent">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Radar className="h-5 w-5 text-gold" />
                    <h3 className="font-black">99win Signals App</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Live, mathematically accurate signals straight from the game
                    engine. The next-round signal is generated automatically —
                    install it on your phone as a PWA and get VIP predictions on
                    the go.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Auto next-round signal — updates by itself
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Exact cash-out target with 99% confidence
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      Installable on mobile via PWA
                    </li>
                  </ul>
                  <Button
                    onClick={() => dispatch(setView('signals'))}
                    className="w-full h-10 font-bold bg-gold text-black hover:bg-gold/85 gap-2"
                  >
                    <Smartphone className="h-4 w-4" /> Open Signals App
                  </Button>
                </CardContent>
              </Card>
              <SignalsLive compact />
            </div>
          </TabsContent>

          {/* users */}
          <TabsContent value="users" className="mt-3">
            <Card className="border-border/70">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Deposits</TableHead>
                        <TableHead className="text-right">Wins</TableHead>
                        <TableHead className="text-right">Losses</TableHead>
                        <TableHead className="text-right">Cashback</TableHead>
                        <TableHead className="text-right">Bets</TableHead>
                        <TableHead className="text-right">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.name}
                            {u.role === 'ADMIN' && (
                              <span className="ml-1.5 text-[9px] font-bold text-gold uppercase">
                                ADMIN
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {u.phone.replace(/(\d{4})\d+(\d{3})/, '$1****$2')}
                          </TableCell>
                          <TableCell className="text-right font-tabular font-bold text-gold">
                            {formatMoney(u.balance, 2)}
                          </TableCell>
                          <TableCell className="text-right font-tabular">
                            {formatMoney(u.totalDeposit)}
                          </TableCell>
                          <TableCell className="text-right font-tabular text-green-500">
                            {formatMoney(u.totalWin)}
                          </TableCell>
                          <TableCell className="text-right font-tabular text-destructive">
                            {formatMoney(u.totalLoss)}
                          </TableCell>
                          <TableCell className="text-right font-tabular text-gold">
                            {formatMoney(u.cashbackEarned)}
                          </TableCell>
                          <TableCell className="text-right font-tabular">
                            {u.betsCount}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
