'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Star, Plus, Search, Brain, Flame, Thermometer, Snowflake, ChevronLeft, ChevronRight, UserCheck, Upload } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import clsx from 'clsx'
import toast from 'react-hot-toast'
type Lead = {
  id: string; first_name: string; last_name: string; email: string
  phone: string; company: string; job_title: string; lead_status: string
  rating: string; ai_score: number | null; assigned_to: string; created_at: string
  crm_users: { full_name: string } | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'converted', label: 'Converted' },
]

const STATUS_TONE: Record<string, ReturnType<typeof pillToneForStatus>> = {
  new:         'blue',
  contacted:   'purple',
  qualified:   'emerald',
  unqualified: 'red',
  converted:   'orange',
  recycled:    'yellow',
}

function RatingIcon({ rating }: { rating: string }) {
  if (rating === 'hot') return <Flame className="w-3.5 h-3.5 text-red-400" />
  if (rating === 'warm') return <Thermometer className="w-3.5 h-3.5 text-orange-400" />
  return <Snowflake className="w-3.5 h-3.5 text-blue-400" />
}

function ScoreBadge({ score, id }: { score: number | null; id: string }) {
  const [loading, setLoading] = useState(false)

  async function runScore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}/score`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`AI Score: ${data.score} — ${data.reason}`)
      window.location.reload()
    } catch {
      toast.error('Scoring failed.')
    } finally {
      setLoading(false)
    }
  }

  if (score !== null) {
    const color = score >= 70 ? 'text-emerald-400 bg-emerald-500/15' : score >= 40 ? 'text-yellow-400 bg-yellow-500/15' : 'text-red-400 bg-red-500/15'
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
  }

  return (
    <button
      onClick={e => { e.preventDefault(); runScore() }}
      disabled={loading}
      className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#F47920] transition px-1"
    >
      <Brain className={clsx('w-3 h-3', loading && 'animate-pulse')} />
      {loading ? 'Scoring…' : 'Score'}
    </button>
  )
}

function ConvertButton({ id, status, onDone }: { id: string; status: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  if (status === 'converted') return null

  async function convert() {
    if (!confirm('Convert this lead to a Contact? This action cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Lead converted to Contact!')
      onDone()
    } catch { toast.error('Conversion failed.') }
    finally { setLoading(false) }
  }

  return (
    <button
      onClick={e => { e.preventDefault(); convert() }}
      disabled={loading}
      className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-emerald-400 transition px-1"
      title="Convert to Contact"
    >
      <UserCheck className={clsx('w-3 h-3', loading && 'animate-pulse')} />
      {loading ? 'Converting…' : 'Convert'}
    </button>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/leads?${params}`)
      const data = await res.json()
      setLeads(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { setPage(1) }, [search, status])
  useEffect(() => { fetchLeads() }, [fetchLeads])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Sales"
        title="Leads"
        subtitle={`${count} total`}
        actions={
          <>
            <Button variant="secondary" href="/leads/bulk" icon={<Upload className="w-4 h-4" />}>Bulk Upload</Button>
            <Button href="/leads/new" icon={<Plus className="w-4 h-4" />}>New Lead</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition"
          />
        </div>
        <Select value={status} onValueChange={v => setStatus(v)}
              options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
      </div>

      {/* Table */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Company</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Rating</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">AI Score</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3 hidden xl:table-cell first:table-cell">
                      <Skeleton variant="text" className="h-3 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={<Star className="w-7 h-7" />}
                    title="No leads yet"
                    description="Start capturing leads to grow your pipeline."
                    actionLabel="Add Lead"
                    actionHref="/leads/new"
                  />
                </td>
              </tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">
                      {lead.first_name} {lead.last_name ?? ''}
                    </p>
                    <p className="text-slate-500 text-xs">{lead.email ?? lead.phone ?? '—'}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                  {lead.company ?? '—'}
                  {lead.job_title && <span className="text-slate-500 text-xs block">{lead.job_title}</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={STATUS_TONE[lead.lead_status] ?? 'slate'} size="sm" uppercase={false} className="capitalize">
                    {lead.lead_status}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-1">
                    <RatingIcon rating={lead.rating} />
                    <span className="text-slate-400 text-xs capitalize">{lead.rating}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <ScoreBadge score={lead.ai_score} id={lead.id} />
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                  {lead.crm_users?.full_name ?? '—'}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <ConvertButton id={lead.id} status={lead.lead_status} onDone={fetchLeads} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-slate-500 text-xs">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
