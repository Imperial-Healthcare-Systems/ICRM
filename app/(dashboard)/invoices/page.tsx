'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Receipt, Plus, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type Invoice = {
  id: string; invoice_number: string; status: string
  issue_date: string; due_date: string; total: number
  paid_amount: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/invoices?${params}`)
      const data = await res.json()
      setInvoices(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const isOverdue = (inv: Invoice) =>
    inv.due_date && new Date(inv.due_date) < new Date() && !['paid','cancelled','void'].includes(inv.status)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Invoices"
        subtitle={`${count} total`}
        actions={
          <Button href="/invoices/new" icon={<Plus className="w-4 h-4" />}>New Invoice</Button>
        }
      />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Invoice #</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Due Date</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : invoices.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<Receipt className="w-7 h-7" />} title="No invoices yet"
                  description="Create invoices or convert from quotations."
                  actionLabel="New Invoice" actionHref="/invoices/new" />
              </td></tr>
            ) : invoices.map((inv, idx) => {
              const overdue = isOverdue(inv)
              return (
                <tr key={inv.id}
                    className={clsx('hover:bg-white/[0.02] transition group anim-rise relative', overdue && 'before:absolute before:left-0 before:inset-y-0 before:w-[2px] before:bg-red-500')}
                    style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="block">
                      <p className="text-white font-medium group-hover:text-[#F47920] transition tabular-nums">{inv.invoice_number}</p>
                      <p className="text-slate-500 text-xs mt-0.5 tabular-nums">{new Date(inv.issue_date).toLocaleDateString('en-IN')}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{inv.crm_accounts?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <StatusPill tone={overdue ? 'red' : pillToneForStatus(inv.status)} size="sm" uppercase={false} className="capitalize">
                      {(overdue ? 'overdue' : inv.status).replace('_', ' ')}
                    </StatusPill>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs hidden lg:table-cell tabular-nums', overdue ? 'text-red-400 font-semibold' : 'text-slate-400')}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-[#F47920] font-bold tabular-nums">{fmt(inv.total, inv.currency)}</p>
                    {inv.paid_amount > 0 && inv.paid_amount < inv.total && (
                      <p className="text-slate-500 text-xs tabular-nums mt-0.5">Paid: {fmt(inv.paid_amount, inv.currency)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!['paid','cancelled','void'].includes(inv.status) && (
                      <Link href={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition px-2.5 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pay
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
            <p className="text-slate-500 text-xs tabular-nums">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
