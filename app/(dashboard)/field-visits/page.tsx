'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { MapPin, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import clsx from 'clsx'

type Visit = {
  id: string; visit_number: string; title: string; status: string
  scheduled_at: string; location: string; created_at: string
  crm_accounts: { name: string } | null
  crm_users: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed:   'bg-emerald-500/20 text-emerald-400',
  cancelled:   'bg-red-500/20 text-red-400',
}

export default function FieldVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/field-visits?${params}`)
      const data = await res.json()
      setVisits(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchVisits() }, [fetchVisits])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Field Visits"
        subtitle={`${count} total`}
        actions={
          <Link href="/field-visits/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> Schedule Visit
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'scheduled', 'in_progress', 'completed', 'cancelled'].map(s => (
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
              <th className="text-left px-4 py-3 font-semibold">Visit</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Scheduled</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : visits.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<MapPin className="w-7 h-7" />} title="No field visits yet" description="Schedule and track client site visits." actionLabel="Schedule Visit" actionHref="/field-visits/new" />
              </td></tr>
            ) : visits.map(v => (
              <tr key={v.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/field-visits/${v.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{v.title}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      {v.visit_number}
                      {v.location && <><span>·</span><MapPin className="w-2.5 h-2.5" />{v.location}</>}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs hidden md:table-cell">{v.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                  {v.scheduled_at ? new Date(v.scheduled_at).toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[v.status] ?? ''}`}>{v.status.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                  {(v.crm_users as { full_name: string } | null)?.full_name ?? '—'}
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
