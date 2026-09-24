'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Trophy } from 'lucide-react'
import { MedalIcon } from '@/components/game/icons'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { setMyBets } from '@/store/slices/uiSlice'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { BetRow } from '@/lib/types'

function Avatar({ name, hue, size = 26 }: { name: string; hue: number; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 55% 22%)`,
        color: `hsl(${hue} 85% 68%)`,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function BetsTabs() {
  const dispatch = useAppDispatch()
  const bets = useAppSelector((s) => s.game.bets)
  const myBets = useAppSelector((s) => s.ui.myBets)
  const leaderboard = useAppSelector((s) => s.game.leaderboard)
  const lastCrash = useAppSelector((s) => s.game.lastGlobalCrash)
  const user = useAppSelector((s) => s.auth.user)
  const [tab, setTab] = useState('all')

  // fetch my bet history whenever the round ends (bet resolved) or tab opens
  useEffect(() => {
    if (!user) return
    api<{ bets: BetRow[] }>('/api/bets/history')
      .then((d) => dispatch(setMyBets(d.bets)))
      .catch(() => {})
  }, [user, lastCrash, dispatch])

  const activeCount = bets.filter((b) => b.status === 'ACTIVE').length

  return (
    <Card className="border-border/80">
      <CardContent className="p-3 sm:p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full mb-3">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All Bets
              <span className="ml-1.5 text-[10px] rounded-full bg-primary/20 text-primary px-1.5 py-0.5 font-tabular">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-xs sm:text-sm">
              My Bets
            </TabsTrigger>
            <TabsTrigger value="top" className="text-xs sm:text-sm">
              <Trophy className="h-3.5 w-3.5 mr-1 text-gold" />
              Top
            </TabsTrigger>
          </TabsList>

          {/* ---- ALL BETS ---- */}
          <TabsContent value="all">
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-1">
                <HeaderRow cols={['Player', 'Bet', 'Mult', 'Win']} />
                <AnimatePresence initial={false}>
                  {bets.length === 0 && (
                    <EmptyRow text="Bets appear here when the round opens…" />
                  )}
                  {[...bets].reverse().map((b) => (
                    <motion.div
                      key={b.betId}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-[1fr_70px_64px_76px] items-center gap-1 rounded-lg px-2 py-1.5 bg-secondary/40 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={b.name} hue={b.hue} />
                        <span className="truncate font-medium">{b.name}</span>
                      </div>
                      <span className="text-right font-tabular text-muted-foreground">
                        {formatMoney(b.amount)}
                      </span>
                      <span className="text-center">
                        {b.status === 'WON' ? (
                          <span className="inline-block rounded-md bg-green-600/20 text-green-500 font-bold font-tabular px-1.5 py-0.5">
                            {b.cashoutM?.toFixed(2)}x
                          </span>
                        ) : b.status === 'LOST' ? (
                          <span className="inline-block rounded-md bg-destructive/15 text-destructive font-bold font-tabular px-1.5 py-0.5">
                            Lost
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-right font-tabular font-bold',
                          b.status === 'WON'
                            ? 'text-green-500'
                            : b.status === 'LOST'
                              ? 'text-destructive/70'
                              : 'text-muted-foreground/40'
                        )}
                      >
                        {b.win != null ? formatMoney(b.win) : '—'}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </TabsContent>

          {/* ---- MY BETS ---- */}
          <TabsContent value="mine">
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-1">
                <HeaderRow cols={['Round', 'Bet', 'At', 'Payout']} />
                {myBets.length === 0 && (
                  <EmptyRow text="Place your first bet — history shows here." />
                )}
                {myBets.map((b) => {
                  const won = b.status === 'CASHED_OUT'
                  const cancelled = b.status === 'CANCELLED'
                  return (
                    <div
                      key={b.id}
                      className="grid grid-cols-[1fr_70px_64px_76px] items-center gap-1 rounded-lg px-2 py-1.5 bg-secondary/40 text-xs"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          #{b.roundId}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(b.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="text-right font-tabular text-muted-foreground">
                        {formatMoney(b.amount)}
                      </span>
                      <span
                        className={cn(
                          'text-center font-tabular font-bold',
                          won ? 'text-green-500' : cancelled ? 'text-muted-foreground' : 'text-destructive'
                        )}
                      >
                        {won
                          ? `${b.cashedOutAt?.toFixed(2)}x`
                          : cancelled
                            ? '—'
                            : `${b.crashPoint.toFixed(2)}x`}
                      </span>
                      <span
                        className={cn(
                          'text-right font-tabular font-bold',
                          won ? 'text-green-500' : cancelled ? 'text-muted-foreground' : 'text-destructive/80'
                        )}
                      >
                        {won ? `+${formatMoney(b.winAmount ?? 0)}` : cancelled ? '—' : `−${formatMoney(b.amount)}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ---- TOP ---- */}
          <TabsContent value="top">
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-1">
                <HeaderRow cols={['#', 'Player', 'Mult', 'Win']} />
                {leaderboard.length === 0 && (
                  <EmptyRow text="Big wins land here — be the first!" />
                )}
                {leaderboard.map((r, i) => (
                  <div
                    key={`${r.ts}-${r.name}`}
                    className="grid grid-cols-[32px_1fr_64px_86px] items-center gap-1 rounded-lg px-2 py-1.5 bg-secondary/40 text-xs"
                  >
                    <span className="text-center flex justify-center">
                      {i <= 2 ? (
                        <MedalIcon rank={i as 0 | 1 | 2} className="h-5 w-5" />
                      ) : (
                        <span className="text-muted-foreground font-tabular">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={r.name} hue={r.hue} />
                      <span className="truncate font-medium">{r.name}</span>
                    </div>
                    <span className="text-center font-tabular font-bold text-gold">
                      {r.multiplier.toFixed(2)}x
                    </span>
                    <span className="text-right font-tabular font-bold text-green-500">
                      +{formatMoney(r.win)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function HeaderRow({ cols }: { cols: string[] }) {
  return (
    <div
      className={cn(
        'grid items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b border-border/60',
        cols.length === 4 && 'grid-cols-[1fr_70px_64px_76px]'
      )}
    >
      {cols.map((c, i) => (
        <span key={c} className={i === 0 ? '' : i > 1 ? 'text-center' : 'text-right'}>
          {c}
        </span>
      ))}
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-xs text-muted-foreground">{text}</div>
  )
}
