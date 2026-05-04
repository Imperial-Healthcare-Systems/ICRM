import clsx from 'clsx'
import { ReactNode } from 'react'

type Tone = 'slate' | 'blue' | 'emerald' | 'red' | 'orange' | 'yellow' | 'purple' | 'cyan' | 'pink' | 'brand'

const TONE_MAP: Record<Tone, string> = {
  slate:   'bg-slate-500/15 text-slate-300',
  blue:    'bg-blue-500/15 text-blue-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  red:     'bg-red-500/15 text-red-400',
  orange:  'bg-orange-500/15 text-orange-400',
  yellow:  'bg-yellow-500/15 text-yellow-400',
  purple:  'bg-purple-500/15 text-purple-400',
  cyan:    'bg-cyan-500/15 text-cyan-400',
  pink:    'bg-pink-500/15 text-pink-400',
  brand:   'bg-[#F47920]/15 text-[#F47920]',
}

const SIZE_MAP = {
  xs: 'text-[9px] px-1.5 py-0.5',
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-[11px] px-2.5 py-1',
}

type StatusPillProps = {
  tone?: Tone
  size?: keyof typeof SIZE_MAP
  icon?: ReactNode
  uppercase?: boolean
  children: ReactNode
  className?: string
}

export default function StatusPill({
  tone = 'slate', size = 'sm', icon, uppercase = true, children, className,
}: StatusPillProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full font-bold tracking-wider whitespace-nowrap',
      TONE_MAP[tone],
      SIZE_MAP[size],
      uppercase && 'uppercase',
      className,
    )}>
      {icon}
      {children}
    </span>
  )
}

/** Standard CRM status → tone mapping. Pass any string; falls back to slate. */
export function pillToneForStatus(status: string | null | undefined): Tone {
  if (!status) return 'slate'
  const s = status.toLowerCase()
  if (['won', 'accepted', 'paid', 'completed', 'active', 'approved', 'resolved', 'sent'].includes(s)) return 'emerald'
  if (['lost', 'rejected', 'cancelled', 'failed', 'overdue', 'expired'].includes(s)) return 'red'
  if (['pending', 'draft', 'on_hold', 'paused'].includes(s)) return 'slate'
  if (['open', 'in_progress', 'sending', 'scheduled', 'qualified'].includes(s)) return 'blue'
  if (['warning', 'partially_paid', 'past_due', 'trial'].includes(s)) return 'yellow'
  if (['urgent', 'high'].includes(s)) return 'orange'
  return 'slate'
}
