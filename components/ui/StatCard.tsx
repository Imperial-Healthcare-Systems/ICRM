import clsx from 'clsx'
import Link from 'next/link'
import { ReactNode } from 'react'

type Tone = 'orange' | 'blue' | 'emerald' | 'purple' | 'pink' | 'yellow' | 'rose' | 'cyan' | 'slate'

const TONE_MAP: Record<Tone, { bg: string; text: string; bar: string }> = {
  orange:  { bg: 'bg-[var(--accent-soft-strong)]', text: 'text-[var(--accent)]', bar: 'bg-[var(--accent)]' },
  blue:    { bg: 'bg-blue-500/15',     text: 'text-blue-400',      bar: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-500/15',  text: 'text-emerald-400',   bar: 'bg-emerald-500' },
  purple:  { bg: 'bg-purple-500/15',   text: 'text-purple-400',    bar: 'bg-purple-500' },
  pink:    { bg: 'bg-pink-500/15',     text: 'text-pink-400',      bar: 'bg-pink-500' },
  yellow:  { bg: 'bg-yellow-500/15',   text: 'text-yellow-400',    bar: 'bg-yellow-500' },
  rose:    { bg: 'bg-rose-500/15',     text: 'text-rose-400',      bar: 'bg-rose-500' },
  cyan:    { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',      bar: 'bg-cyan-500' },
  slate:   { bg: 'bg-slate-500/15',    text: 'text-slate-400',     bar: 'bg-slate-500' },
}

type StatCardProps = {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: Tone
  /** Renders a thin progress bar at the bottom edge (0–100) */
  progress?: number
  /** Optional trend delta — e.g. "+12%" rendered next to value */
  delta?: { value: string; positive: boolean }
  href?: string
  onClick?: () => void
  active?: boolean
  className?: string
}

export default function StatCard({
  label, value, hint, icon, tone = 'orange', progress, delta, href, onClick, active, className,
}: StatCardProps) {
  const t = TONE_MAP[tone]
  const interactive = !!href || !!onClick

  const inner = (
    <>
      {icon && (
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center mb-3', t.bg, t.text)}>
          {icon}
        </div>
      )}
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-[var(--text-primary)] font-bold text-2xl tabular-nums leading-none">{value}</p>
        {delta && (
          <span className={clsx(
            'text-[11px] font-bold tabular-nums',
            delta.positive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {delta.positive ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
      <p className="text-[var(--text-tertiary)] text-[11px] mt-1.5 tracking-wide">{label}</p>
      {hint && <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{hint}</p>}

      {progress !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--surface-sunken)] overflow-hidden">
          <div
            className={clsx('h-full transition-all duration-700', t.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </>
  )

  const surfaceCls = clsx(
    'relative bg-[var(--surface)] border rounded-xl p-4 overflow-hidden transition-all',
    interactive && 'hover-lift cursor-pointer',
    active
      ? 'border-[var(--accent)]/40 shadow-[0_0_0_1px_var(--accent-ring)]'
      : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] shadow-[var(--shadow-sm)]',
    className,
  )

  if (href) {
    return <Link href={href} className={surfaceCls}>{inner}</Link>
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={clsx(surfaceCls, 'text-left w-full')}>{inner}</button>
  }
  return <div className={surfaceCls}>{inner}</div>
}
