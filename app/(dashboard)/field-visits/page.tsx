'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { MapPin, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type Visit = {
  id: string; visit_number: string; title: string; status: string
  scheduled_at: string; location: string; created_at: string
  crm_accounts: { name: string } | null
  crm_users: { full_name: string } | null
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
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchVisits() }, [fetchVisits])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Operations"
        title="Field Visits"
        subtitle={`${count} total`}
        actions={<Button href="/field-visits/new" icon={<Plus className="w-4 h-4" />}>Schedule Visit</Button>}
      />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['', 'scheduled', 'in_progress', 'completed', 'cancelled'].map(s => (
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
              <th className="text-left px-4 py-3 font-semibold">Visit</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Scheduled</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : visits.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<MapPin className="w-7 h-7" />} title="No field visits yet"
                  description="Schedule and track client site visits."
                  actionLabel="Schedule Visit" actionHref="/field-visits/new" />
              </td></tr>
            ) : visits.map((v, idx) => (
              <tr key={v.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/field-visits/${v.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{v.title}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 tabular-nums">
                      {v.visit_number}
                      {v.location && <><span>·</span><MapPin className="w-2.5 h-2.5" />{v.location}</>}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs hidden md:table-cell">{v.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell tabular-nums">
                  {v.scheduled_at ? new Date(v.scheduled_at).toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(v.status)} size="sm" uppercase={false} className="capitalize">{v.status.replace('_', ' ')}</StatusPill>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                  {(v.crm_users as { full_name: string } | null)?.full_name ?? '—'}
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
