'use client'

import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

type Quota = {
  id: string; user_id: string; territory_id: string | null
  period_type: string; period_start: string; period_end: string
  target_amount: number; currency: string; metric: string
  notes: string | null; achieved: number
  crm_users: { id: string; full_name: string; email: string } | null
  crm_territories: { id: string; name: string } | null
}

const fmtNum = (n: number, c = 'INR', metric = 'revenue') => {
  if (metric === 'revenue') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat('en-IN').format(n)
}
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const METRIC_LABEL: Record<string, string> = {
  revenue: 'Revenue', deals_won: 'Deals Won', new_accounts: 'New Accounts',
  calls: 'Calls', meetings: 'Meetings',
}

function bandFor(pct: number) {
  if (pct >= 100) return { stroke: '#10b981', text: 'text-emerald-400', icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Hit target' }
  if (pct >= 80)  return { stroke: '#22c55e', text: 'text-emerald-400', icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'On track' }
  if (pct >= 50)  return { stroke: '#eab308', text: 'text-yellow-400',  icon: <Minus className="w-3.5 h-3.5" />,        label: 'Behind pace' }
  return            { stroke: '#ef4444', text: 'text-red-400',     icon: <TrendingDown className="w-3.5 h-3.5" />, label: 'At risk' }
}

function CircularGauge({ pct, color }: { pct: number; color: string }) {
  const r = 56
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, pct) / 100) * c
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white font-bold text-3xl tabular-nums">{pct.toFixed(0)}%</span>
        <span className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">achieved</span>
      </div>
    </div>
  )
}

export default function QuotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <DetailShell<Quota>
      id={id}
      apiPath="/api/quotas"
      backHref="/quotas"
      entityLabel="quota"
      title={(q) => `${q.crm_users?.full_name ?? 'Unassigned'} — ${METRIC_LABEL[q.metric] ?? q.metric}`}
      subtitle={(q) => `${q.period_type} · ${fmtDate(q.period_start)} → ${fmtDate(q.period_end)}`}
      validate={(f) => {
        const n = Number(f.target_amount)
        if (!n || n <= 0) return 'Target must be positive.'
        return null
      }}
      buildPayload={(f) => ({
        target_amount: Number(f.target_amount),
        period_end: f.period_end,
        territory_id: f.territory_id || null,
        notes: f.notes ?? null,
      })}
      sidebar={(record) => {
        const pct = record.target_amount > 0 ? Math.min(999, (record.achieved / record.target_amount) * 100) : 0
        const band = bandFor(pct)
        const remaining = Math.max(0, Number(record.target_amount) - Number(record.achieved))
        return (
          <div className="bg-[#0D1B2E] border border-white/5 rounded-2xl p-5">
            <CircularGauge pct={pct} color={band.stroke} />

            <div className={clsx('flex items-center justify-center gap-1.5 mt-3 text-xs font-bold', band.text)}>
              {band.icon} {band.label}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-white/3 rounded-lg p-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Achieved</p>
                <p className="text-white font-bold text-sm tabular-nums mt-0.5 leading-tight">{fmtNum(record.achieved, record.currency, record.metric)}</p>
              </div>
              <div className="bg-white/3 rounded-lg p-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Target</p>
                <p className="text-white font-bold text-sm tabular-nums mt-0.5 leading-tight">{fmtNum(record.target_amount, record.currency, record.metric)}</p>
              </div>
              <div className="bg-white/3 rounded-lg p-3 col-span-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Remaining</p>
                <p className="text-[#F47920] font-bold text-base tabular-nums mt-0.5">{fmtNum(remaining, record.currency, record.metric)}</p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/5 space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Rep</span><span className="text-white truncate ml-2">{record.crm_users?.full_name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Territory</span><span className="text-white truncate ml-2">{record.crm_territories?.name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Metric</span><span className="text-white">{METRIC_LABEL[record.metric] ?? record.metric}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Period</span><span className="text-white capitalize">{record.period_type}</span></div>
            </div>
          </div>
        )
      }}
    >
      {(_record, form, update) => (
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Target Amount *</label>
            <input type="number" min="0" step="0.01" className={inputCls}
              value={form.target_amount ?? ''} onChange={e => update('target_amount', Number(e.target.value) as never)} /></div>
          <div><label className={labelCls}>Period End</label>
            <input type="date" className={inputCls} value={form.period_end ?? ''}
              onChange={e => update('period_end', e.target.value as never)} /></div>
          <div className="col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.notes ?? ''}
              onChange={e => update('notes', e.target.value as never)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
