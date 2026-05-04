'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { TicketCheck, Plus, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type Ticket = {
  id: string; ticket_number: string; title: string; status: string
  priority: string; type: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
}

const PRIORITY_TONE: Record<string, 'slate' | 'blue' | 'orange' | 'red'> = {
  low: 'slate', medium: 'blue', high: 'orange', critical: 'red',
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      if (priority) params.set('priority', priority)
      const res = await fetch(`/api/tickets?${params}`)
      const data = await res.json()
      setTickets(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, status, priority])

  useEffect(() => { setPage(1) }, [status, priority])
  useEffect(() => { fetchTickets() }, [fetchTickets])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Customer Service"
        title="Support Tickets"
        subtitle={`${count} total`}
        actions={<Button href="/support/new" icon={<Plus className="w-4 h-4" />}>New Ticket</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 flex-wrap">
          {['', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                status === s ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}>
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto flex-wrap">
          {['', 'low', 'medium', 'high', 'critical'].map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                priority === p ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}>
              {p === '' ? 'Any Priority' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Ticket</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Priority</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : tickets.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<TicketCheck className="w-7 h-7" />} title="No tickets yet"
                  description="Support tickets from clients will appear here."
                  actionLabel="New Ticket" actionHref="/support/new" />
              </td></tr>
            ) : tickets.map((t, idx) => (
              <tr key={t.id} className={clsx('hover:bg-white/[0.02] transition group anim-rise relative', t.priority === 'critical' && 'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-red-500')}
                  style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/support/${t.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition flex items-center gap-1.5">
                      {t.priority === 'critical' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      {t.title}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5 tabular-nums">{t.ticket_number} · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell text-xs">
                  {t.crm_accounts?.name ?? (t.crm_contacts ? `${t.crm_contacts.first_name} ${t.crm_contacts.last_name ?? ''}` : '—')}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={PRIORITY_TONE[t.priority] ?? 'slate'} size="sm" uppercase={false} className="capitalize">{t.priority}</StatusPill>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(t.status)} size="sm" uppercase={false} className="capitalize">{t.status.replace('_', ' ')}</StatusPill>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                  {(t.crm_users as { full_name: string } | null)?.full_name ?? '—'}
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
