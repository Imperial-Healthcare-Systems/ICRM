'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import clsx from 'clsx'

type Proposal = {
  id: string; proposal_number: string; title: string; status: string
  valid_until: string; total: number; currency: string; created_at: string
  crm_accounts: { name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-slate-500/20 text-slate-400',
  sent:     'bg-blue-500/20 text-blue-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired:  'bg-orange-500/20 text-orange-400',
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/proposals?${params}`)
      const data = await res.json()
      setProposals(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchProposals() }, [fetchProposals])

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Proposals"
        subtitle={`${count} total`}
        actions={
          <Link href="/proposals/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Proposal
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => (
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
              <th className="text-left px-4 py-3 font-semibold">Proposal</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Valid Until</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : proposals.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<BookOpen className="w-7 h-7" />} title="No proposals yet" description="Create professional proposals to win clients." actionLabel="New Proposal" actionHref="/proposals/new" />
              </td></tr>
            ) : proposals.map(p => (
              <tr key={p.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/proposals/${p.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{p.title}</p>
                    <p className="text-slate-500 text-xs">{p.proposal_number}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{p.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[p.status] ?? ''}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                  {p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold hidden xl:table-cell">{fmt(p.total, p.currency)}</td>
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
