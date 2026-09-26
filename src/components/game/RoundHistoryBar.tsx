'use client'

import { useAppSelector } from '@/store/store'
import { cn } from '@/lib/utils'

function pillClass(m: number) {
  if (m < 2) return 'text-[#00bdff]'
  if (m < 10) return 'text-[#a139ff]'
  return 'text-[#e000bf]'
}

export default function RoundHistoryBar() {
  const history = useAppSelector((s) => s.game.history)
  return (
    <div className="round-history">
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
              'h-7 px-1 flex items-center justify-center text-sm font-tabular shrink-0',
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
