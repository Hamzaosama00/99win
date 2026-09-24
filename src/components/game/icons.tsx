'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * icons.tsx — first-party SVG icon set. The app renders ZERO emoji glyphs:
 * every decorative mark is an inline, scalable SVG. Chat text supports
 * `:token:` codes (e.g. `:fire:`) that the rich-text renderer swaps for
 * these icons, so even bot chatter stays emoji-free.
 */

type IconProps = { className?: string }

const S = 24 // all icons are drawn on a 24x24 grid

/* ---------------- UI: stroke icons (lucide-style) ---------------- */

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={cn('h-3.5 w-3.5', className)} aria-hidden>
      <path d="M4 12.5 L9.5 18 L20 6.5" />
    </svg>
  )
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={cn('h-3.5 w-3.5', className)} aria-hidden>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

export function PlaneTakeoffIcon({ className }: IconProps) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('h-4 w-4', className)} aria-hidden>
      <path d="M2 22h20" />
      <path d="M6.5 9.5 3.5 8.7a1 1 0 0 1-.6-1.6l1.3-1.4a1 1 0 0 1 1-.3l4.6 1.2 4.4-4.2a1.4 1.4 0 0 1 2 2l-3.4 3.6 4.3 1.4 2.4-1.4a1.2 1.2 0 0 1 1.4 1.9l-3.2 2.8a2 2 0 0 1-1.8.4L7 11.6a2 2 0 0 1-.5-.1Z" />
    </svg>
  )
}

/* ---------------- Leaderboard medals ---------------- */

const MEDAL_COLORS = {
  gold: { ring: '#f7c948', face: '#ffd968', deep: '#b57e00', num: '#6b4a00' },
  silver: { ring: '#c9d3dd', face: '#e6edf3', deep: '#8a97a5', num: '#4a5560' },
  bronze: { ring: '#d2935a', face: '#eab183', deep: '#8f5a2b', num: '#4f2f12' },
} as const

export function MedalIcon({ rank, className }: IconProps & { rank: 0 | 1 | 2 }) {
  const c = MEDAL_COLORS[rank === 0 ? 'gold' : rank === 1 ? 'silver' : 'bronze']
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn('h-4.5 w-4.5', className)} aria-hidden>
      {/* ribbons */}
      <path d="M8.2 1.5 12 8.2 15.8 1.5 H20 L14.6 11 H9.4 L4 1.5 Z" fill={c.deep} opacity="0.9" />
      <path d="M8.2 1.5 12 8.2 9.4 11 H4 Z" fill={c.ring} opacity="0.85" />
      {/* medal disc */}
      <circle cx="12" cy="15.5" r="7.2" fill={c.face} stroke={c.ring} strokeWidth="1.6" />
      <circle cx="12" cy="15.5" r="4.6" fill="none" stroke={c.deep} strokeWidth="1" opacity="0.55" />
      <text
        x="12" y="18.4" textAnchor="middle" fontSize="7.4" fontWeight="800"
        fill={c.num} fontFamily="inherit"
      >
        {rank + 1}
      </text>
    </svg>
  )
}

/* ---------------- Chat sticker icons (filled, colorful) ---------------- */

function Sticker({ className, children, label }: IconProps & { children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn('inline h-4 w-4 -mt-0.5 mx-0.5 align-middle', className)} role="img" aria-label={label}>
      {children}
    </svg>
  )
}

export function FireIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="fire">
      <path d="M12 2c.6 3-1.6 4.6-3 6.4C7.4 10.4 6 12.3 6 15a6 6 0 0 0 12 0c0-2-1-3.9-2.2-5.4-.4 1-.9 1.7-1.8 2.4.3-3.6-.6-7.4-2-10Z" fill="#ff7a1a" />
      <path d="M12 21.2a3.6 3.6 0 0 1-3.6-3.6c0-1.9 1.6-3 2.6-4.5.4-.6.8-1.3 1-2 .9 1.6 3.6 3.4 3.6 6.5a3.6 3.6 0 0 1-3.6 3.6Z" fill="#ffd166" />
    </Sticker>
  )
}

export function RocketIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="rocket">
      <path d="M13.4 3.3c2.9-1.4 6-1.5 7.3-1.3.2 1.3.1 4.4-1.3 7.3-1.2 2.6-3.2 4.6-5.2 6l-4.2-4.2c1.4-2 3.4-4 3.4-7.8Z" fill="#e6edf3" transform="translate(-1.4 1.4)" />
      <circle cx="15.2" cy="8.8" r="1.9" fill="#e8114b" />
      <path d="M6.1 17.9c-1-1-1.4-2.9-.6-3.7l2.3-2.3 4.3 4.3-2.3 2.3c-.8.8-2.7.4-3.7-.6Z" fill="#ff7a1a" />
      <path d="M5 22c.4-1.4.8-2.3 1.6-3.1l-.5-.5C5.3 19.2 4.4 19.6 3 20c.8-.8 2-1.3 2.6-1.5l.9.9C6.3 20 5.8 21.2 5 22Z" fill="#f7c948" />
    </Sticker>
  )
}

export function BoomIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="crash">
      <path d="M12 1.8 14 8l6.2-2-4.4 4.8L22 13l-6.3 1 2 6-5.2-3.6L8.6 22l.2-6.5L3 17l4.2-4.6L2 9.4l6.5-.3L7 3l5 3.6Z" fill="#ff7a1a" />
      <circle cx="12" cy="12.5" r="4" fill="#ffd166" />
    </Sticker>
  )
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="done">
      <circle cx="12" cy="12" r="10" fill="#22c55e" />
      <path d="M7 12.6 10.4 16 17.2 8.6" fill="none" stroke="#eafff0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </Sticker>
  )
}

export function BrokenHeartIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="heartbreak">
      <path d="M12 21S3.5 15.4 3.5 9.3C3.5 6 6 4 8.5 4c1.5 0 2.8.7 3.5 1.8C12.7 4.7 14 4 15.5 4 18 4 20.5 6 20.5 9.3 20.5 15.4 12 21 12 21Z" fill="#ff4d6d" />
      <path d="M12 5.8 10 10l3 1.6-2.6 4.4 1.8.6 3.4-5.4-3.2-1.6L14 6Z" fill="#0b0e13" opacity="0.85" />
    </Sticker>
  )
}

export function CryIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="crying">
      <circle cx="12" cy="12" r="10" fill="#ffd166" />
      <path d="M6.8 9.6c.5-1 1.9-1 2.4 0" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.8 9.6c.5-1 1.9-1 2.4 0" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 16.4c1.1-1.1 5.9-1.1 7 0" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.5 12.5c1.6 2 2.3 3.2 2.3 4.2a2.3 2.3 0 0 1-4.6 0c0-1 .7-2.2 2.3-4.2Z" fill="#59b7f0" />
    </Sticker>
  )
}

export function MoneyFlyIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="money flying">
      <rect x="2.5" y="8" width="16" height="9.5" rx="1.6" fill="#22c55e" transform="rotate(-8 10.5 12.7)" />
      <circle cx="10.5" cy="12.4" r="2.7" fill="#eafff0" transform="rotate(-8 10.5 12.4)" />
      <path d="M17.5 4.5c1.8.8 2.9 1.9 3.5 3.4M18.9 2.2c2.3 1 3.7 2.4 4.4 4.3" fill="none" stroke="#7be3a2" strokeWidth="1.6" strokeLinecap="round" />
    </Sticker>
  )
}

export function LaughIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="laughing">
      <circle cx="12" cy="12" r="10" fill="#ffd166" />
      <path d="M6.6 9.2c.6-1.2 2.2-1.2 2.8 0M14.6 9.2c.6-1.2 2.2-1.2 2.8 0" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.8 13.4h10.4a5.2 5.2 0 0 1-10.4 0Z" fill="#6b4a00" />
    </Sticker>
  )
}

export function SmirkIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="smirk">
      <circle cx="12" cy="12" r="10" fill="#ffd166" />
      <path d="M6.6 9.4c.5-1 1.9-1 2.4 0M14.6 9.4c.5-1 1.9-1 2.4 0" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 15.6c2.6 1.4 6 1.2 8-.6" fill="none" stroke="#6b4a00" strokeWidth="1.7" strokeLinecap="round" />
    </Sticker>
  )
}

export function EyesIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="looking">
      <ellipse cx="7.2" cy="12" rx="4.2" ry="5.4" fill="#eafff0" stroke="#2a3242" strokeWidth="1.2" />
      <ellipse cx="16.8" cy="12" rx="4.2" ry="5.4" fill="#eafff0" stroke="#2a3242" strokeWidth="1.2" />
      <circle cx="8.4" cy="12.6" r="2" fill="#2a3242" />
      <circle cx="18" cy="12.6" r="2" fill="#2a3242" />
    </Sticker>
  )
}

export function FishIcon({ className }: IconProps) {
  return (
    <Sticker className={className} label="fish">
      <path d="M3 12c2.6-4 6.3-6 9.8-6 3.2 0 6 1.9 7.7 4.6L22 12l-1.5 1.4C18.8 16.1 16 18 12.8 18 9.3 18 5.6 16 3 12Z" fill="#59b7f0" />
      <circle cx="7.6" cy="11" r="1.2" fill="#12324a" />
      <path d="M12.8 6.2c-1.6 3.6-1.6 8 0 11.6" fill="none" stroke="#3d8fc4" strokeWidth="1.3" />
    </Sticker>
  )
}

/* ---------------- Rich text: `:token:` → inline SVG ---------------- */

const TOKENS: Record<string, (p: IconProps) => ReactNode> = {
  fire: FireIcon,
  rocket: RocketIcon,
  boom: BoomIcon,
  check: CheckCircleIcon,
  broken: BrokenHeartIcon,
  cry: CryIcon,
  money: MoneyFlyIcon,
  laugh: LaughIcon,
  smirk: SmirkIcon,
  eyes: EyesIcon,
  fish: FishIcon,
  plane: (p) => (
    <PlaneTakeoffIcon
      {...p}
      className={cn('inline h-4 w-4 align-middle mx-0.5 -mt-0.5 text-primary', p.className)}
    />
  ),
}

const TOKEN_RE = /:(fire|rocket|boom|check|broken|cry|money|laugh|smirk|eyes|fish|plane):/g

/**
 * renderRichText — converts `:token:` codes inside chat strings into inline
 * SVG icons. Anything that is not a known token renders as plain text.
 */
export function renderRichText(text: string): ReactNode {
  const parts = text.split(TOKEN_RE)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const Icon = TOKENS[part]
      return Icon ? <Icon key={i} /> : part
    }
    return part
  })
}
