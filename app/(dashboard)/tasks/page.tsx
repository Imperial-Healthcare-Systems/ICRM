'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CheckSquare, Plus, Search, Play } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Task = {
  id: string; title: string; status: string; priority: string
  due_date: string | null; estimated_minutes: number | null; actual_minutes: number
  project_id: string | null
  crm_users: { full_name: string } | null
  crm_projects: { id: string; name: string } | null
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400', medium: 'text-blue-400',
  high: 'text-orange-400', critical: 'text-red-400',
}

const fmtMins = (m: number | null) => {
  if (!m) return '—'
  const h = Math.floor(m / 60), mm = m % 60
  return h ? `${h}h ${mm}m` : `${mm}m`
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      setTasks(data.data ?? [])
    } finally { setLoading(false) }
  }, [search, status])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function startTimer(taskId: string, projectId: string | null) {
    const res = await fetch('/api/time-entries/timer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, project_id: projectId }),
    })
    if (res.ok) toast.success('Timer started.')
    else toast.error('Failed to start timer.')
  }

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Delivery"
        title="Tasks"
        subtitle={`${tasks.length} loaded`}
        actions={<Button href="/tasks/new" icon={<Plus className="w-4 h-4" />}>New Task</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition" />
        </div>
        <div className="w-44">
          <Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
            options={['todo','in_progress','review','done','cancelled'].map(s => ({ value: s, label: s.replace('_', ' ') }))} />
        </div>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Title</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Project</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Priority</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Due</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Time</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assignee</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : tasks.length === 0 ? (
              <tr><td colSpan={8}>
                <EmptyState icon={<CheckSquare className="w-7 h-7" />} title="No tasks yet"
                  description="Create a task or add tasks inside a project."
                  actionLabel="New Task" actionHref="/tasks/new" />
              </td></tr>
            ) : tasks.map((t, idx) => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/tasks/${t.id}`} className="text-white font-medium group-hover:text-[#F47920] transition">{t.title}</Link>
                </td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                  {t.crm_projects ? <Link href={`/projects/${t.crm_projects.id}`} className="hover:text-[#F47920] transition">{t.crm_projects.name}</Link> : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(t.status)} size="sm" uppercase={false} className="capitalize">{t.status.replace('_', ' ')}</StatusPill>
                </td>
                <td className={clsx('px-4 py-3 text-xs font-medium capitalize hidden lg:table-cell', PRIORITY_COLORS[t.priority])}>{t.priority}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell tabular-nums">{t.due_date ?? '—'}</td>
                <td className="px-4 py-3 text-right text-emerald-400 text-xs hidden xl:table-cell tabular-nums">{fmtMins(t.actual_minutes)}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">{t.crm_users?.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {t.status !== 'done' && (
                    <button onClick={() => startTimer(t.id, t.project_id)}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-[10px] font-semibold transition px-2 py-1 rounded-md" title="Start timer">
                      <Play className="w-3 h-3" /> Track
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
