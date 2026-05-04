'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileSignature, Plus, ChevronLeft, ChevronRight, ArrowRight, Info } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Quote = {
  id: string; quote_number: string; status: string; valid_until: string
  total: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
}

const STATUS_OPTIONS = ['', 'draft', 'sent', 'accepted', 'rejected', 'expired']

export default function EstimatesPage() {
  const [items, setItems] = useState<Quote[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), is_estimate: 'true' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/quotations?${params}`)
      const data = await res.json()
      setItems(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchAll() }, [fetchAll])

  async function convertToQuotation(id: string) {
    if (!confirm('Promote this estimate to a quotation? A new QT- number will be assigned.')) return
    const res = await fetch(`/api/quotations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_estimate: false }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Conversion failed.'); return }
    toast.success(`Promoted to ${data.data?.quote_number ?? 'quotation'}.`)
    fetchAll()
  }

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        kicker="Finance"
        title="Estimates"
        subtitle={`${count} total — lighter, faster quotations`}
        actions={
          <Button href="/estimates/new" icon={<Plus className="w-4 h-4" />}>
            New Estimate
          </Button>
        }
      />

      {/* Info banner — distinguishes Estimates from Quotations */}
      <div className="bg-gradient-to-r from-[#F47920]/10 to-[#F47920]/5 border border-[#F47920]/20 rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#F47920]/15 text-[#F47920] flex items-center justify-center shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">Estimates are <span className="text-[#F47920]">draft pricing</span> for quick client conversations.</p>
          <p className="text-slate-400 text-xs mt-0.5">
            They use the <span className="font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded">EST-</span> prefix and live separately from formal quotations.
            Click <span className="text-[#F47920] font-semibold">Promote</span> when one is ready to become a binding <span className="font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded">QT-</span>.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200')}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Estimate #</th>
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
            )) : items.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<FileSignature className="w-7 h-7" />} title="No estimates yet"
                  description="Estimates are quick, lighter quotations — promote one to a full quotation when ready."
                  actionLabel="New Estimate" actionHref="/estimates/new" />
              </td></tr>
            ) : items.map((q, idx) => (
              <tr key={q.id} className="hover:bg-white/3 transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/quotations/${q.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F47920]/15 text-[#F47920]">EST</span>
                      <p className="text-white font-medium group-hover:text-[#F47920] transition tabular-nums">{q.quote_number}</p>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{new Date(q.created_at).toLocaleDateString('en-IN')}</p>
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
                  <button onClick={() => convertToQuotation(q.id)}
                    title="Promote to Quotation"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-[#F47920] hover:bg-[#F47920]/10 text-xs font-semibold transition whitespace-nowrap px-2.5 py-1.5 rounded-lg">
                    Promote <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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
