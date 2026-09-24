'use client'

import { useAppSelector } from '@/store/store'
import { cn } from '@/lib/utils'

function pillClass(m: number) {
  if (m < 2) return 'bg-[#3d1420] text-[#ff4d6d] border-[#e8114b]/30'
  if (m < 10) return 'bg-[#332314] text-[#c98bff] border-[#a855f7]/30'
  return 'bg-[#3a2e10] text-gold border-gold/40'
}

export default function RoundHistoryBar() {
  const history = useAppSelector((s) => s.game.history)
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex h-8 items-center rounded-lg bg-secondary px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
        History
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5" aria-label="Round history">
        {history.length === 0 && (
          <span className="text-xs text-muted-foreground py-1">
            Waiting for first round…
          </span>
        )}
        {history.map((m, i) => (
          <span
            key={`${i}-${m}`}
            className={cn(
              'h-7 min-w-[52px] px-2 flex items-center justify-center rounded-lg border text-xs font-bold font-tabular shrink-0 animate-rise',
              pillClass(m)
            )}
          >
            {m.toFixed(2)}x
          </span>
        ))}
      </div>
    </div>
  )
}
