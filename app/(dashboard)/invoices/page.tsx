'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Receipt, Plus, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Invoice = {
  id: string; invoice_number: string; status: string
  issue_date: string; due_date: string; total: number
  paid_amount: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  draft:          'bg-slate-500/20 text-slate-400',
  sent:           'bg-blue-500/20 text-blue-400',
  partially_paid: 'bg-yellow-500/20 text-yellow-400',
  paid:           'bg-emerald-500/20 text-emerald-400',
  overdue:        'bg-red-500/20 text-red-400',
  cancelled:      'bg-orange-500/20 text-orange-400',
  void:           'bg-gray-500/20 text-gray-400',
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
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const isOverdue = (inv: Invoice) =>
    inv.due_date && new Date(inv.due_date) < new Date() && !['paid','cancelled','void'].includes(inv.status)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Invoices"
        subtitle={`${count} total`}
        actions={
          <Link href="/invoices/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
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
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : invoices.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<Receipt className="w-7 h-7" />} title="No invoices yet" description="Create invoices or convert from quotations." actionLabel="New Invoice" actionHref="/invoices/new" />
              </td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className={clsx('hover:bg-white/3 transition group', isOverdue(inv) && 'border-l-2 border-red-500')}>
                <td className="px-4 py-3">
                  <Link href={`/invoices/${inv.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{inv.invoice_number}</p>
                    <p className="text-slate-500 text-xs">{new Date(inv.issue_date).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                  {inv.crm_accounts?.name ?? '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[inv.status] ?? ''}`}>
                    {(isOverdue(inv) ? 'overdue' : inv.status).replace('_', ' ')}
                  </span>
                </td>
                <td className={clsx('px-4 py-3 text-xs hidden lg:table-cell', isOverdue(inv) ? 'text-red-400 font-semibold' : 'text-slate-400')}>
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-[#F47920] font-bold">{fmt(inv.total, inv.currency)}</p>
                  {inv.paid_amount > 0 && inv.paid_amount < inv.total && (
                    <p className="text-slate-500 text-xs">Paid: {fmt(inv.paid_amount, inv.currency)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!['paid','cancelled','void'].includes(inv.status) && (
                    <Link href={`/invoices/${inv.id}`}
                      className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 text-xs font-medium transition">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pay
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-slate-500 text-xs">{count} total · Page {page} of {totalPages}</p>
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
