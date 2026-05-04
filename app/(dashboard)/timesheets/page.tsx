'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Clock, Play, Square, Plus, Trash2, Loader2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Entry = {
  id: string; description: string | null; started_at: string; ended_at: string | null
  duration_secs: number | null; is_billable: boolean; project_id: string | null; task_id: string | null
  notes: string | null
  crm_users: { id: string; full_name: string } | null
  crm_projects: { id: string; name: string } | null
  crm_tasks: { id: string; title: string } | null
}

const fmtDur = (s: number | null) => {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export default function TimesheetsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [running, setRunning] = useState<{ id: string; startedAt: string; project?: string; task?: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [showLogModal, setShowLogModal] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ scope })
      if (projectId) params.set('project_id', projectId)
      const [eRes, pRes, tRes] = await Promise.all([
        fetch(`/api/time-entries?${params}`).then(r => r.json()),
        fetch('/api/projects?pageSize=200').then(r => r.json()),
        fetch('/api/time-entries/timer').then(r => r.json()),
      ])
      setEntries(eRes.data ?? [])
      setProjects(pRes.data ?? [])
      if (tRes.data) {
        const t = tRes.data as { id: string; started_at: string; crm_projects?: { name: string } | null; crm_tasks?: { title: string } | null }
        setRunning({ id: t.id, startedAt: t.started_at, project: t.crm_projects?.name, task: t.crm_tasks?.title })
      } else setRunning(null)
    } finally { setLoading(false) }
  }, [scope, projectId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!running) return
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000)), 1000)
    return () => clearInterval(i)
  }, [running])

  async function stopTimer() {
    const res = await fetch('/api/time-entries/timer', { method: 'DELETE' })
    if (res.ok) { toast.success('Timer stopped.'); fetchData() }
    else toast.error('Failed to stop.')
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this time entry?')) return
    const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted.'); fetchData() }
    else toast.error('Delete failed.')
  }

  // Group by date
  const grouped: Record<string, Entry[]> = {}
  for (const e of entries) {
    const day = e.started_at.slice(0, 10)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(e)
  }
  const days = Object.keys(grouped).sort().reverse()

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const totalSecs = entries.reduce((s, e) => s + (e.duration_secs ?? 0), 0)

  return (
    <div className="p-6 mx-auto max-w-5xl">
      <PageHeader
        kicker="Delivery"
        title="Timesheets"
        subtitle={`${entries.length} entries · ${fmtDur(totalSecs)}`}
        actions={<Button onClick={() => setShowLogModal(true)} icon={<Plus className="w-4 h-4" />}>Log Time</Button>}
      />

      {/* Active timer banner */}
      {running && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Timer running</p>
              <p className="text-white text-sm">{running.task ?? running.project ?? 'No project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white font-bold tabular-nums text-xl">{formatElapsed(elapsed)}</span>
            <button onClick={stopTimer} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              <Square className="w-4 h-4" /> Stop
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="w-32">
          <Select value={scope} onValueChange={v => setScope(v as 'mine' | 'all')}
            options={[{ value: 'mine', label: 'My entries' }, { value: 'all', label: 'Everyone' }]} />
        </div>
        <div className="w-56">
          <Select value={projectId} onValueChange={setProjectId} placeholder="All projects" allowClear clearLabel="All projects"
            options={projects.map(p => ({ value: p.id, label: p.name }))} />
        </div>
      </div>

      {/* Entries grouped by day */}
      <div className="space-y-4">
        {loading ? <Skeleton className="h-32 rounded-xl" /> :
          days.length === 0 ? (
            <div className="surface-premium">
              <EmptyState icon={<Clock className="w-7 h-7" />} title="No time logged yet"
                description="Start a timer from a task or log time manually." />
            </div>
          ) : days.map(day => {
            const dayEntries = grouped[day]
            const daySecs = dayEntries.reduce((s, e) => s + (e.duration_secs ?? 0), 0)
            return (
              <div key={day} className="surface-premium overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                  <p className="text-white font-semibold text-sm">{fmtDate(day)}</p>
                  <p className="text-emerald-400 text-xs font-medium tabular-nums">{fmtDur(daySecs)}</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {dayEntries.map((e, idx) => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-medium">
                            {e.crm_tasks?.title ?? e.description ?? 'Untitled'}
                          </p>
                          {e.is_billable && <StatusPill tone="emerald" size="xs">Billable</StatusPill>}
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {e.crm_projects?.name && <Link href={`/projects/${e.crm_projects.id}`} className="hover:text-[#F47920] transition">{e.crm_projects.name}</Link>}
                          {e.crm_users?.full_name && <span> · {e.crm_users.full_name}</span>}
                          {e.ended_at && <span className="tabular-nums"> · {fmtDateTime(e.started_at)} → {fmtDateTime(e.ended_at)}</span>}
                        </p>
                      </div>
                      <span className="text-white font-semibold text-sm tabular-nums">{fmtDur(e.duration_secs)}</span>
                      <button onClick={() => deleteEntry(e.id)} className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-md transition" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        }
      </div>

      {showLogModal && <LogTimeModal projects={projects} onClose={() => setShowLogModal(false)} onLogged={() => { setShowLogModal(false); fetchData() }} />}
    </div>
  )
}

function LogTimeModal({ projects, onClose, onLogged }: { projects: { id: string; name: string }[]; onClose: () => void; onLogged: () => void }) {
  const todayDate = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    project_id: '', task_id: '', description: '',
    date: todayDate, start_time: '09:00', end_time: '10:00',
    is_billable: true,
  })
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!form.project_id) { setTasks([]); return }
    fetch(`/api/tasks?project_id=${form.project_id}`).then(r => r.json()).then(d => setTasks(d.data ?? []))
  }, [form.project_id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const startedAt = new Date(`${form.date}T${form.start_time}:00`).toISOString()
    const endedAt = new Date(`${form.date}T${form.end_time}:00`).toISOString()
    if (new Date(endedAt) <= new Date(startedAt)) { toast.error('End time must be after start time.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: form.project_id || null,
          task_id: form.task_id || null,
          description: form.description || null,
          started_at: startedAt,
          ended_at: endedAt,
          is_billable: form.is_billable,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Time logged.'); onLogged()
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-emerald-400" /> Log Time</h2>
        <div className="space-y-3">
          <div><label className={labelCls}>Project</label>
            <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v, task_id: '' }))}
              placeholder="No project" allowClear clearLabel="No project"
              options={projects.map(p => ({ value: p.id, label: p.name }))} /></div>
          {tasks.length > 0 && (
            <div><label className={labelCls}>Task</label>
              <Select value={form.task_id} onValueChange={v => setForm(f => ({ ...f, task_id: v }))}
                placeholder="No task" allowClear clearLabel="No task"
                options={tasks.map(t => ({ value: t.id, label: t.title }))} /></div>
          )}
          <div><label className={labelCls}>Description</label>
            <input className={inputCls} placeholder="What did you work on?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className={labelCls}>Start</label>
              <input type="time" className={inputCls} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
            <div><label className={labelCls}>End</label>
              <input type="time" className={inputCls} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_billable} onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked }))}
              className={clsx('w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]')} />
            <span className="text-white text-xs">Billable</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {submitting ? 'Logging…' : 'Log Time'}
          </button>
        </div>
      </form>
    </div>
  )
}
