'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Plus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Quote = {
  id: string; quote_number: string; status: string; valid_until: string
  total: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
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
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), is_estimate: 'false' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/quotations?${params}`)
      const data = await res.json()
      setQuotes(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  async function convertToInvoice(id: string) {
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
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Quotations"
        subtitle={`${count} total`}
        actions={
          <Button href="/quotations/new" icon={<Plus className="w-4 h-4" />}>New Quotation</Button>
        }
      />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="surface-premium overflow-hidden">
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
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : quotes.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<FileText className="w-7 h-7" />} title="No quotations yet"
                  description="Create quotations to send professional proposals to clients."
                  actionLabel="New Quotation" actionHref="/quotations/new" />
              </td></tr>
            ) : quotes.map((q, idx) => (
              <tr key={q.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/quotations/${q.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition tabular-nums">{q.quote_number}</p>
                    <p className="text-slate-500 text-xs mt-0.5 tabular-nums">{new Date(q.created_at).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                  {q.crm_accounts?.name ?? (q.crm_contacts ? `${q.crm_contacts.first_name} ${q.crm_contacts.last_name ?? ''}` : '—')}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(q.status)} size="sm" uppercase={false} className="capitalize">{q.status}</StatusPill>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell tabular-nums">
                  {q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums">{fmt(q.total, q.currency)}</td>
                <td className="px-4 py-3 text-right">
                  {q.status !== 'accepted' && (
                    <button
                      onClick={() => convertToInvoice(q.id)}
                      title="Convert to Invoice"
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-[#F47920] hover:bg-[#F47920]/10 text-xs font-semibold transition whitespace-nowrap px-2.5 py-1.5 rounded-lg"
                    >
                      Invoice <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
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
