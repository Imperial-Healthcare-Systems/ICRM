'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Plus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Quote = {
  id: string; quote_number: string; status: string; valid_until: string
  total: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-slate-500/20 text-slate-400',
  sent:     'bg-blue-500/20 text-blue-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired:  'bg-orange-500/20 text-orange-400',
}

const STATUS_OPTIONS = ['', 'draft', 'sent', 'accepted', 'rejected', 'expired']

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/quotations?${params}`)
      const data = await res.json()
      setQuotes(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  async function convertToInvoice(id: string, quoteNumber: string) {
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    toast.success(`Invoice ${data.data.invoice_number} created!`)
    fetchQuotes()
  }

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Quotations"
        subtitle={`${count} total`}
        actions={
          <Link href="/quotations/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Quotation
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Quote #</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Valid Until</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : quotes.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<FileText className="w-7 h-7" />} title="No quotations yet" description="Create quotations to send professional proposals to clients." actionLabel="New Quotation" actionHref="/quotations/new" />
              </td></tr>
            ) : quotes.map(q => (
              <tr key={q.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/quotations/${q.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{q.quote_number}</p>
                    <p className="text-slate-500 text-xs">{new Date(q.created_at).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                  {q.crm_accounts?.name ?? (q.crm_contacts ? `${q.crm_contacts.first_name} ${q.crm_contacts.last_name ?? ''}` : '—')}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[q.status] ?? ''}`}>{q.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                  {q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold">{fmt(q.total, q.currency)}</td>
                <td className="px-4 py-3">
                  {q.status !== 'accepted' && (
                    <button
                      onClick={() => convertToInvoice(q.id, q.quote_number)}
                      title="Convert to Invoice"
                      className="flex items-center gap-1 text-slate-500 hover:text-[#F47920] text-xs font-medium transition whitespace-nowrap"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /> Invoice
                    </button>
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
