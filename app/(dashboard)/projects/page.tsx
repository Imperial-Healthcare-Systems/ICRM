'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FolderKanban, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import clsx from 'clsx'

type Project = {
  id: string; name: string; status: string; priority: string
  start_date: string | null; end_date: string | null
  budget: number | null; currency: string; is_billable: boolean
  crm_accounts: { id: string; name: string } | null
  crm_users: { id: string; full_name: string } | null
  created_at: string
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400', medium: 'text-blue-400',
  high: 'text-orange-400', critical: 'text-red-400',
}

const fmt = (n: number | null, c = 'INR') =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/projects?${params}`)
      const data = await res.json()
      setProjects(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { setPage(1) }, [search, status])
  useEffect(() => { fetchProjects() }, [fetchProjects])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Delivery"
        title="Projects"
        subtitle={`${count} total`}
        actions={<Button href="/projects/new" icon={<Plus className="w-4 h-4" />}>New Project</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition" />
        </div>
        <div className="w-44">
          <Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
            options={['planning','active','on_hold','completed','cancelled'].map(s => ({ value: s, label: s.replace('_', ' ') }))} />
        </div>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Project</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Priority</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Budget</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : projects.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<FolderKanban className="w-7 h-7" />} title="No projects yet"
                  description="Create your first project to start tracking deliverables and time."
                  actionLabel="New Project" actionHref="/projects/new" />
              </td></tr>
            ) : projects.map((p, idx) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/projects/${p.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{p.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5 tabular-nums">{p.start_date ?? '—'} → {p.end_date ?? '—'}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{p.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(p.status)} size="sm" uppercase={false} className="capitalize">
                    {p.status.replace('_', ' ')}
                  </StatusPill>
                </td>
                <td className={clsx('px-4 py-3 text-xs font-medium capitalize hidden lg:table-cell', PRIORITY_COLORS[p.priority])}>{p.priority}</td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums hidden xl:table-cell">{fmt(p.budget, p.currency)}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">{p.crm_users?.full_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
            <p className="text-slate-500 text-xs tabular-nums">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
