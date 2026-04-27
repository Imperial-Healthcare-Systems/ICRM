'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { TicketCheck, Plus, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import clsx from 'clsx'

type Ticket = {
  id: string; ticket_number: string; title: string; status: string
  priority: string; type: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  waiting:     'bg-purple-500/20 text-purple-400',
  resolved:    'bg-emerald-500/20 text-emerald-400',
  closed:      'bg-slate-500/20 text-slate-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-slate-500/20 text-slate-400',
  medium:   'bg-blue-500/20 text-blue-400',
  high:     'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
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
    } finally {
      setLoading(false)
    }
  }, [page, status, priority])

  useEffect(() => { setPage(1) }, [status, priority])
  useEffect(() => { fetchTickets() }, [fetchTickets])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Support Tickets"
        subtitle={`${count} total`}
        actions={
          <Link href="/support/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {['', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                status === s ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {['', 'low', 'medium', 'high', 'critical'].map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                priority === p ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
              {p === '' ? 'Any Priority' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
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
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : tickets.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<TicketCheck className="w-7 h-7" />} title="No tickets yet" description="Support tickets from clients will appear here." actionLabel="New Ticket" actionHref="/support/new" />
              </td></tr>
            ) : tickets.map(t => (
              <tr key={t.id} className={clsx('hover:bg-white/3 transition group', t.priority === 'critical' && 'border-l-2 border-red-500')}>
                <td className="px-4 py-3">
                  <Link href={`/support/${t.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition flex items-center gap-1.5">
                      {t.priority === 'critical' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      {t.title}
                    </p>
                    <p className="text-slate-500 text-xs">{t.ticket_number} · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell text-xs">
                  {t.crm_accounts?.name ?? (t.crm_contacts ? `${t.crm_contacts.first_name} ${t.crm_contacts.last_name ?? ''}` : '—')}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[t.priority] ?? ''}`}>{t.priority}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[t.status] ?? ''}`}>{t.status.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                  {(t.crm_users as { full_name: string } | null)?.full_name ?? '—'}
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
