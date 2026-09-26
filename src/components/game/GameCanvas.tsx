'use client'

import { useEffect, useRef } from 'react'
import { Plane } from 'lucide-react'
import { useAppSelector } from '@/store/store'
import { onTick, multiplierAt } from '@/lib/socket'

/**
 * GameCanvas — the Aviator flight graph.
 * Canvas renders at 60fps via rAF (multiplier curve, plane, stars);
 * DOM overlays (multiplier text, countdown) are updated imperatively
 * to avoid React re-renders.
 */
export default function GameCanvas() {
  const phase = useAppSelector((s) => s.game.phase)
  const startedAt = useAppSelector((s) => s.game.startedAt)
  const endsAt = useAppSelector((s) => s.game.endsAt)
  const crash = useAppSelector((s) => s.game.lastGlobalCrash)
  const roundId = useAppSelector((s) => s.game.roundId)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const multWrapRef = useRef<HTMLDivElement>(null)
  const multTextRef = useRef<HTMLSpanElement>(null)
  const countTextRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // refs mirrored for the rAF loop
  const phaseRef = useRef(phase)
  const startedAtRef = useRef(startedAt)
  const endsAtRef = useRef(endsAt)
  const crashRef = useRef(crash)
  const endedAtRef = useRef<number | null>(null)
  const lastTickRef = useRef<{ tMs: number; perfAt: number } | null>(null)

  useEffect(() => {
    phaseRef.current = phase
    if (phase === 'ENDED' && endedAtRef.current === null) {
      endedAtRef.current = performance.now()
    }
    if (phase !== 'ENDED') endedAtRef.current = null
  }, [phase])
  useEffect(() => {
    startedAtRef.current = startedAt
  }, [startedAt])
  useEffect(() => {
    endsAtRef.current = endsAt
  }, [endsAt])
  useEffect(() => {
    crashRef.current = crash
  }, [crash])

  useEffect(() => onTick((tMs) => {
    lastTickRef.current = { tMs, perfAt: performance.now() }
  }), [])

  // ---- render loop ----
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
      const wrap = wrapRef.current!
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = wrap.clientWidth
      h = wrap.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current!)
    resize()

    const yFrac = (m: number) => Math.min(0.9, Math.log(m) / Math.log(3.4))

    // ---- plane sprite (/plane.svg) with vector fallback ----
    const planeImg = new Image()
    let planeReady = false
    planeImg.onload = () => {
      planeReady = true
    }
    planeImg.src = '/aviator-plane.svg'

    const PLANE_W = 138
    const PLANE_H = PLANE_W * (72 / 128) // keep viewBox aspect

    const drawPlaneSprite = (x: number, y: number, rot: number, alpha: number, size = PLANE_W) => {
      const pw = size
      const ph = size * (72 / 128)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 12
      if (planeReady) {
        ctx.drawImage(planeImg, -pw / 2, -ph / 2, pw, ph)
      } else {
        // temporary vector plane while the sprite loads
        ctx.fillStyle = '#e8114b'
        ctx.beginPath()
        ctx.moveTo(-pw / 2, 0)
        ctx.quadraticCurveTo(-pw * 0.2, -ph * 0.55, pw * 0.28, -ph * 0.35)
        ctx.quadraticCurveTo(pw * 0.55, -ph * 0.15, pw / 2, 0)
        ctx.quadraticCurveTo(pw * 0.55, ph * 0.15, pw * 0.28, ph * 0.4)
        ctx.quadraticCurveTo(-pw * 0.2, ph * 0.5, -pw / 2, 0)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#f4f6f8'
        ctx.beginPath()
        ctx.moveTo(0, ph * 0.1)
        ctx.lineTo(-pw * 0.28, ph * 0.62)
        ctx.lineTo(-pw * 0.12, ph * 0.68)
        ctx.lineTo(pw * 0.1, ph * 0.28)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const now = performance.now()
      const phaseNow = phaseRef.current
      const pad = 0

      // ---- background ----
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      // Fan rays originate at the lower-left corner, as in the reference.
      const radius = Math.hypot(w, h) * 1.2
      for (let i = 0; i < 24; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 48
        ctx.beginPath(); ctx.moveTo(0, h)
        ctx.arc(0, h, radius, a, a + Math.PI / 96)
        ctx.closePath(); ctx.fillStyle = '#101012'; ctx.fill()
      }
      const halo = ctx.createRadialGradient(w * .52, h * .52, 0, w * .52, h * .52, w * .55)
      halo.addColorStop(0, 'rgba(100,40,170,.70)'); halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h)

      const baseX = pad
      const baseY = h - 2

      // runway (waiting)
      if (phaseNow === 'WAITING') {
        const dashY = baseY + 14
        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'
        ctx.lineWidth = 3
        ctx.setLineDash([22, 22])
        ctx.lineDashOffset = -((now * 0.06) % 44)
        ctx.beginPath()
        ctx.moveTo(baseX, dashY)
        ctx.lineTo(w - pad, dashY)
        ctx.stroke()
        ctx.restore()
      }

      // ---- multiplier / curve ----
      let est = 0
      if (phaseNow === 'FLYING') {
        const lt = lastTickRef.current
        est = lt
          ? lt.tMs + (now - lt.perfAt)
          : startedAtRef.current
            ? performance.timeOrigin + now - startedAtRef.current
            : 0
      } else if (phaseNow === 'ENDED' && crashRef.current) {
        est = (Math.log(crashRef.current) / 0.15) * 1000
      }

      const xProg = phaseNow !== 'WAITING' ? 1 - Math.exp(-est / 2850) : 0
      const mNow = phaseNow === 'FLYING' ? multiplierAt(est) : 0

      if (phaseNow !== 'WAITING' && est > 0) {
        // curve path
        const pts: Array<[number, number]> = []
        const N = 48
        for (let i = 0; i <= N; i++) {
          const xi = (xProg * i) / N
          const ti = -2.85 * Math.log(1 - Math.min(xi, 0.9999))
          const mi = multiplierAt(ti * 1000)
          pts.push([
            pad + xi * (w - pad * 2 - 30),
            baseY - yFrac(mi) * (h - pad * 2 - 30),
          ])
        }

        const crashed = phaseNow === 'ENDED'
        const strokeColor = '#f50043'
        const glow = crashed ? 'rgba(255,45,85,0.5)' : 'rgba(255,138,61,0.45)'

        // area fill
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, 'rgba(220,0,55,0.62)')
        grad.addColorStop(1, 'rgba(180,0,25,0.65)')
        ctx.beginPath()
        ctx.moveTo(pts[0][0], baseY)
        for (const [px, py] of pts) ctx.lineTo(px, py)
        ctx.lineTo(pts[pts.length - 1][0], baseY)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        // stroke
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (const [px, py] of pts) ctx.lineTo(px, py)
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 3.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = glow
        ctx.shadowBlur = 0
        ctx.stroke()
        ctx.shadowBlur = 0

        // plane at the tip
        const tipX = pts[pts.length - 1][0]
        const tipY = pts[pts.length - 1][1]
        let planeX = tipX
        let planeY = tipY
        let planeAlpha = 1
        if (crashed && endedAtRef.current !== null) {
          const off = now - endedAtRef.current
          planeX = tipX + off * 0.42
          planeY = tipY - off * 0.30
          planeAlpha = Math.max(0, 1 - off / 900)
        }
        drawPlaneSprite(planeX, planeY, -0.15, planeAlpha)
      } else if (phaseNow === 'WAITING') {
        // idle plane bobbing at runway start
        const bob = Math.sin(now / 380) * 4
        drawPlaneSprite(baseX + 28, baseY - 14 + bob, -0.08 + Math.sin(now / 380) * 0.03, 1, 56)
      }

      // ---- DOM overlays ----
      if (multWrapRef.current) {
        multWrapRef.current.style.opacity = phaseNow === 'FLYING' ? '1' : '0'
      }
      if (multTextRef.current && phaseNow === 'FLYING') {
        multTextRef.current.textContent = `${mNow.toFixed(2)}x`
      }
      if (phaseNow === 'WAITING' && endsAtRef.current && countTextRef.current && barRef.current) {
        const remain = Math.max(0, endsAtRef.current - Date.now())
        countTextRef.current.textContent = `${(remain / 1000).toFixed(1)}s`
        barRef.current.style.width = `${Math.min(100, (remain / 7000) * 100)}%`
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const crashed = phase === 'ENDED'

  return (
    <div
      ref={wrapRef}
      className="flight-canvas relative w-full overflow-hidden select-none"
      role="img"
      aria-label="Aviator multiplier flight graph"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* flying multiplier */}
      <div
        ref={multWrapRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150"
      >
        <span
          ref={multTextRef}
          className="flight-multiplier font-tabular"
        >
          1.00x
        </span>
      </div>

      {!phase && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Connecting to game…</div>}
      {/* waiting overlay */}
      {phase === 'WAITING' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/35 pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-spin [animation-duration:1.6s] border-t-primary" />
            <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
              <Plane className="h-7 w-7 text-primary -rotate-45 animate-float-y" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Next round
            </p>
            <span ref={countTextRef} className="text-3xl font-black font-tabular text-white">
              7.0s
            </span>
            <div className="w-44 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div ref={barRef} className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-muted-foreground pt-1">Place your bets now</p>
          </div>
        </div>
      )}

      {/* crashed overlay */}
      {crashed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none animate-rise">
          <p className="text-2xl sm:text-3xl font-black text-[#ff2d55] tracking-wide [text-shadow:0_0_24px_rgba(255,45,85,0.6)]">
            FLEW AWAY!
          </p>
          <p className="text-4xl sm:text-5xl font-black text-[#ff2d55] font-tabular">
            {(crash ?? 1).toFixed(2)}x
          </p>
        </div>
      )}

      {/* round chip */}
      <div className="absolute bottom-2 right-3 text-[10px] font-mono text-muted-foreground/70">
        #{roundId}
      </div>
    </div>
  )
}
