'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Target, Plus, TrendingUp, TrendingDown, Minus, Activity, ShieldCheck, AlertTriangle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/ui/StatCard'
import StatusPill from '@/components/ui/StatusPill'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import clsx from 'clsx'

type Quota = {
  id: string; user_id: string; territory_id: string | null
  period_type: string; period_start: string; period_end: string
  target_amount: number; currency: string; metric: string
  achieved: number
  crm_users: { id: string; full_name: string } | null
  crm_territories: { id: string; name: string } | null
}

const fmtNum = (n: number, c = 'INR', metric = 'revenue') => {
  if (metric === 'revenue') {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
    if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
    if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
  }
  return new Intl.NumberFormat('en-IN').format(n)
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

const METRIC_LABEL: Record<string, string> = {
  revenue: 'Revenue', deals_won: 'Deals Won', new_accounts: 'New Accounts',
  calls: 'Calls', meetings: 'Meetings',
}

const PERIOD_FILTERS: { key: string; label: string }[] = [
  { key: '',          label: 'All' },
  { key: 'monthly',   label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly',    label: 'Yearly' },
]

function bandFor(pct: number) {
  if (pct >= 100) return { bar: 'from-emerald-400 to-emerald-500', text: 'text-emerald-400', shadow: 'shadow-emerald-500/30', icon: <TrendingUp className="w-3 h-3" />, label: 'Hit', tone: 'emerald' as const }
  if (pct >= 80)  return { bar: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400', shadow: 'shadow-emerald-500/20', icon: <TrendingUp className="w-3 h-3" />, label: 'On track', tone: 'emerald' as const }
  if (pct >= 50)  return { bar: 'from-yellow-500 to-amber-500',    text: 'text-yellow-400',  shadow: 'shadow-yellow-500/20',  icon: <Minus className="w-3 h-3" />,        label: 'Behind', tone: 'yellow' as const }
  return            { bar: 'from-red-500 to-rose-500',              text: 'text-red-400',     shadow: 'shadow-red-500/20',     icon: <TrendingDown className="w-3 h-3" />, label: 'At risk', tone: 'red' as const }
}

export default function QuotasPage() {
  const [items, setItems] = useState<Quota[]>([])
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quotas')
      const data = await res.json()
      setItems(data.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const visible = useMemo(
    () => periodFilter ? items.filter(q => q.period_type === periodFilter) : items,
    [items, periodFilter]
  )

  const summary = useMemo(() => {
    const revenueOnly = visible.filter(q => q.metric === 'revenue')
    const totalTarget = revenueOnly.reduce((s, q) => s + Number(q.target_amount), 0)
    const totalAchieved = revenueOnly.reduce((s, q) => s + Number(q.achieved), 0)
    const overallPct = totalTarget > 0 ? Math.min(100, (totalAchieved / totalTarget) * 100) : 0
    const onTrack = visible.filter(q => q.target_amount > 0 && (q.achieved / q.target_amount) >= 0.8).length
    const atRisk  = visible.filter(q => q.target_amount > 0 && (q.achieved / q.target_amount) < 0.5).length
    return { totalTarget, totalAchieved, overallPct, onTrack, atRisk, count: visible.length }
  }, [visible])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        kicker="Performance"
        title="Quotas"
        subtitle="Sales targets per rep per period"
        actions={
          <Button href="/quotas/new" icon={<Plus className="w-4 h-4" />}>
            New Quota
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Overall achievement"
          value={`${summary.overallPct.toFixed(0)}%`}
          hint={`${fmtNum(summary.totalAchieved)} of ${fmtNum(summary.totalTarget)}`}
          tone="orange"
          icon={<Activity className="w-[18px] h-[18px]" />}
          progress={summary.overallPct}
        />
        <StatCard
          label="Active quotas"
          value={summary.count}
          hint={periodFilter || 'all periods'}
          tone="blue"
          icon={<Target className="w-[18px] h-[18px]" />}
        />
        <StatCard
          label="On track"
          value={summary.onTrack}
          hint="≥ 80% pace"
          tone="emerald"
          icon={<ShieldCheck className="w-[18px] h-[18px]" />}
        />
        <StatCard
          label="At risk"
          value={summary.atRisk}
          hint="< 50% pace"
          tone="rose"
          icon={<AlertTriangle className="w-[18px] h-[18px]" />}
        />
      </div>

      {/* Period filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {PERIOD_FILTERS.map(p => (
          <button key={p.key} onClick={() => setPeriodFilter(p.key)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              periodFilter === p.key
                ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200')}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<Target className="w-7 h-7" />} title="No quotas yet"
            description="Set sales targets per rep per period — track revenue, deals won, calls or meetings."
            actionLabel="New Quota" actionHref="/quotas/new" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((q, idx) => {
            const pct = q.target_amount > 0 ? Math.min(100, (q.achieved / q.target_amount) * 100) : 0
            const band = bandFor(pct)
            return (
              <Link key={q.id} href={`/quotas/${q.id}`}
                className="surface-premium hover-lift p-5 transition group anim-rise hover:border-[#F47920]/30"
                style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}>
                <div className="flex items-start gap-3 mb-4">
                  <Avatar name={q.crm_users?.full_name} brand size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate group-hover:text-[#F47920] transition">{q.crm_users?.full_name ?? 'Unassigned'}</p>
                    <p className="text-slate-500 text-[11px] truncate mt-0.5">
                      {q.crm_territories?.name ?? 'No territory'} · <span className="capitalize">{q.period_type}</span>
                    </p>
                  </div>
                  <StatusPill tone="brand" size="xs">{METRIC_LABEL[q.metric] ?? q.metric}</StatusPill>
                </div>

                <div className="flex items-baseline justify-between mb-2.5">
                  <p className="text-white text-xl font-bold tabular-nums">{fmtNum(q.achieved, q.currency, q.metric)}</p>
                  <p className="text-slate-400 text-xs tabular-nums">/ {fmtNum(q.target_amount, q.currency, q.metric)}</p>
                </div>

                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={clsx('h-full bg-gradient-to-r transition-all duration-700 shadow-lg', band.bar, band.shadow)} style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between mt-3 text-[10px]">
                  <span className="text-slate-500 tabular-nums">{fmtDate(q.period_start)} — {fmtDate(q.period_end)}</span>
                  <span className={clsx('flex items-center gap-1 font-bold tabular-nums', band.text)}>
                    {band.icon} {pct.toFixed(0)}% · {band.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
