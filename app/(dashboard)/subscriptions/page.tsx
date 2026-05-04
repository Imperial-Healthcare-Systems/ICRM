'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Plus, Pause } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import StatCard from '@/components/ui/StatCard'
import Select from '@/components/ui/Select'
import clsx from 'clsx'

type Sub = {
  id: string; subscription_number: string; name: string; status: string
  amount: number; currency: string; billing_cycle: string
  start_date: string; end_date: string | null; next_billing_date: string
  invoices_generated: number; auto_renew: boolean
  crm_accounts: { id: string; name: string } | null
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const res = await fetch(`/api/subscriptions?${params}`)
      const data = await res.json()
      setSubs(data.data ?? [])
    } finally { setLoading(false) }
  }, [status])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  const monthlyMRR = subs
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      const factor = s.billing_cycle === 'monthly' ? 1
        : s.billing_cycle === 'quarterly' ? 1 / 3
        : s.billing_cycle === 'half_yearly' ? 1 / 6
        : s.billing_cycle === 'yearly' ? 1 / 12
        : s.billing_cycle === 'weekly' ? 4.33
        : 1
      return sum + Number(s.amount) * factor
    }, 0)

  const todayStr = new Date().toISOString().split('T')[0]
  const dueSoon = subs.filter(s => s.status === 'active' && s.next_billing_date <= todayStr)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Subscriptions"
        subtitle={`${subs.length} total · MRR ${fmt(Math.round(monthlyMRR))}`}
        actions={<Button href="/subscriptions/new" icon={<Plus className="w-4 h-4" />}>New Subscription</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active"        value={subs.filter(s => s.status === 'active').length} tone="emerald" />
        <StatCard label="MRR"           value={fmt(Math.round(monthlyMRR))}                    tone="orange" />
        <StatCard label="Paused"        value={subs.filter(s => s.status === 'paused').length} tone="yellow" />
        <StatCard label="Due / Overdue" value={dueSoon.length}                                  tone={dueSoon.length > 0 ? 'rose' : 'slate'} />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="w-44">
          <Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
            options={['active', 'paused', 'cancelled', 'expired'].map(s => ({ value: s, label: s }))} />
        </div>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Sub #</th>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Cycle</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Next Bill</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Invoices</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : subs.length === 0 ? (
              <tr><td colSpan={8}>
                <EmptyState icon={<RefreshCw className="w-7 h-7" />} title="No subscriptions yet"
                  description="Set up recurring billing for retainer clients, SaaS plans, or AMC contracts."
                  actionLabel="New Subscription" actionHref="/subscriptions/new" />
              </td></tr>
            ) : subs.map((s, idx) => (
              <tr key={s.id} className="hover:bg-white/[0.02] group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/subscriptions/${s.id}`} className="text-white font-mono text-xs group-hover:text-[#F47920] transition tabular-nums">{s.subscription_number}</Link>
                </td>
                <td className="px-4 py-3 text-slate-300">{s.name}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{s.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums">{fmt(s.amount, s.currency)}</td>
                <td className="px-4 py-3 text-slate-400 capitalize hidden lg:table-cell">{s.billing_cycle.replace('_', ' ')}</td>
                <td className={clsx('px-4 py-3 text-xs hidden lg:table-cell tabular-nums', s.next_billing_date <= todayStr && s.status === 'active' ? 'text-orange-400 font-semibold' : 'text-slate-400')}>{fmtDate(s.next_billing_date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusPill tone={pillToneForStatus(s.status)} size="sm" uppercase={false} className="capitalize">{s.status}</StatusPill>
                    {s.status === 'paused' && <Pause className="w-3 h-3 text-yellow-400" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-400 text-xs hidden xl:table-cell tabular-nums">{s.invoices_generated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
