'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { Globe, Activity, CheckCircle, Clock, Zap } from 'lucide-react'

type EcosystemEvent = {
  id: string
  event_type: string
  source_platform: string
  org_id: string
  payload: Record<string, unknown>
  processed: boolean
  created_at: string
}

const EVENT_COLORS: Record<string, string> = {
  'deal.won':             'text-emerald-400 bg-emerald-400/10',
  'employee.onboarded':   'text-blue-400 bg-blue-400/10',
  'employee.exited':      'text-red-400 bg-red-400/10',
  'leave.approved':       'text-yellow-400 bg-yellow-400/10',
  'payroll.approved':     'text-purple-400 bg-purple-400/10',
  'warning.issued':       'text-orange-400 bg-orange-400/10',
  'appreciation.issued':  'text-pink-400 bg-pink-400/10',
}

export default function EcosystemPage() {
  const [events, setEvents] = useState<EcosystemEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'processed' | 'pending'>('all')

  useEffect(() => {
    fetch('/api/ecosystem/events').then(r => r.json()).then(d => {
      setEvents(d.data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = events.filter(e => {
    if (filter === 'processed') return e.processed
    if (filter === 'pending') return !e.processed
    return true
  })

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const stats = {
    total: events.length,
    processed: events.filter(e => e.processed).length,
    pending: events.filter(e => !e.processed).length,
  }

  return (
    <div className="p-6 mx-auto max-w-6xl space-y-6">
      <PageHeader kicker="Integration" title="Imperial Ecosystem" subtitle="Cross-module event log shared with IHRMS" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Events', value: stats.total,     icon: <Globe className="w-[18px] h-[18px]" />,        tone: 'bg-blue-500/15 text-blue-400' },
          { label: 'Processed',    value: stats.processed, icon: <CheckCircle className="w-[18px] h-[18px]" />,  tone: 'bg-emerald-500/15 text-emerald-400' },
          { label: 'Pending',      value: stats.pending,   icon: <Clock className="w-[18px] h-[18px]" />,        tone: 'bg-yellow-500/15 text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="surface-premium p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.tone}`}>{s.icon}</div>
            <p className="text-white text-2xl font-bold tabular-nums leading-none">{loading ? '—' : s.value}</p>
            <p className="text-slate-400 text-[11px] mt-1.5 tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'processed', 'pending'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
              filter === f ? 'bg-[#F47920]/15 text-[#F47920] border border-[#F47920]/30' : 'text-slate-400 hover:text-white'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Events table */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="h-48 animate-pulse bg-white/3" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-600 text-sm">No ecosystem events yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Event</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Payload</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => (
                <tr key={ev.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition">
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${EVENT_COLORS[ev.event_type] ?? 'text-slate-400 bg-white/5'}`}>
                      <Zap className="w-3 h-3" />
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-slate-400 text-xs font-mono uppercase">{ev.source_platform}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <code className="text-slate-600 text-xs truncate max-w-xs block">
                      {JSON.stringify(ev.payload).slice(0, 80)}…
                    </code>
                  </td>
                  <td className="px-5 py-3.5">
                    {ev.processed
                      ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3 h-3" /> Done</span>
                      : <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock className="w-3 h-3" /> Pending</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-slate-500 text-xs">{fmtDate(ev.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
