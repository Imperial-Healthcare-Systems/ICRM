'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Receipt, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import StatCard from '@/components/ui/StatCard'
import Select from '@/components/ui/Select'

type Expense = {
  id: string; expense_number: string; amount: number; currency: string
  expense_date: string; category: string; description: string; status: string
  is_billable: boolean; reimbursable: boolean
  crm_users: { full_name: string } | null
  crm_projects: { id: string; name: string } | null
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ scope })
      if (status) params.set('status', status)
      const res = await fetch(`/api/expenses?${params}`)
      const data = await res.json()
      setExpenses(data.data ?? [])
    } finally { setLoading(false) }
  }, [scope, status])

  useEffect(() => { fetch_() }, [fetch_])

  const totalsByStatus = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + Number(e.amount)
    return acc
  }, {})

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Expenses"
        subtitle={`${expenses.length} entries · ${fmt(expenses.reduce((s, e) => s + Number(e.amount), 0))}`}
        actions={<Button href="/expenses/new" icon={<Plus className="w-4 h-4" />}>New Expense</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Submitted"  value={fmt(totalsByStatus.submitted ?? 0)}  tone="blue" />
        <StatCard label="Approved"   value={fmt(totalsByStatus.approved ?? 0)}   tone="emerald" />
        <StatCard label="Reimbursed" value={fmt(totalsByStatus.reimbursed ?? 0)} tone="purple" />
        <StatCard label="Rejected"   value={fmt(totalsByStatus.rejected ?? 0)}   tone="rose" />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="w-36"><Select value={scope} onValueChange={v => setScope(v as 'mine' | 'all')}
          options={[{ value: 'mine', label: 'My expenses' }, { value: 'all', label: 'All (admin)' }]} /></div>
        <div className="w-44"><Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
          options={['draft','submitted','approved','rejected','reimbursed'].map(s => ({ value: s, label: s }))} /></div>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Number</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Description</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Submitter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : expenses.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState icon={<Receipt className="w-7 h-7" />} title="No expenses yet"
                  description="Submit expenses for reimbursement or to bill back to clients."
                  actionLabel="New Expense" actionHref="/expenses/new" />
              </td></tr>
            ) : expenses.map((e, idx) => (
              <tr key={e.id} className="hover:bg-white/[0.02] group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3"><Link href={`/expenses/${e.id}`} className="text-white font-mono text-xs group-hover:text-[#F47920] transition tabular-nums">{e.expense_number}</Link></td>
                <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{fmtDate(e.expense_date)}</td>
                <td className="px-4 py-3 text-slate-300">{e.description}</td>
                <td className="px-4 py-3 text-slate-400 text-xs capitalize hidden md:table-cell">{e.category.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums">{fmt(e.amount, e.currency)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusPill tone={pillToneForStatus(e.status)} size="sm" uppercase={false} className="capitalize">{e.status}</StatusPill>
                    {e.is_billable && <StatusPill tone="emerald" size="xs">Bill</StatusPill>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{e.crm_users?.full_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
