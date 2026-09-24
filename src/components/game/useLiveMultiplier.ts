'use client'

import { useEffect, useState } from 'react'
import { onTick, multiplierAt } from '@/lib/socket'

/**
 * Live multiplier at 60fps — anchored to server ticks (10/s) and
 * interpolated locally between them.
 */
export function useLiveMultiplier(enabled: boolean): number {
  const [m, setM] = useState(1)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let lastTick: { tMs: number; perfAt: number } | null = null
    const un = onTick((tMs) => {
      lastTick = { tMs, perfAt: performance.now() }
    })
    const loop = () => {
      raf = requestAnimationFrame(loop)
      let est: number
      if (lastTick) {
        est = lastTick.tMs + (performance.now() - lastTick.perfAt)
      } else {
        est = performance.timeOrigin + performance.now()
      }
      setM(multiplierAt(est))
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      un()
    }
  }, [enabled])

  return enabled ? m : 1
}
