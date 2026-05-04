'use client'
import { use, useEffect, useState } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import Select from '@/components/ui/Select'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Play, Square } from 'lucide-react'

type Task = {
  id: string; title: string; description: string; status: string; priority: string
  due_date: string | null; estimated_minutes: number | null; actual_minutes: number
  project_id: string | null; assignee_id: string | null
  crm_users: { id: string; full_name: string } | null
  crm_projects: { id: string; name: string } | null
}

const STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done', 'cancelled']
const PRIORITY = ['low', 'medium', 'high', 'critical']
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-500/15 text-slate-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  review: 'bg-yellow-500/15 text-yellow-400',
  done: 'bg-emerald-500/15 text-emerald-400',
  cancelled: 'bg-red-500/15 text-red-400',
}

const fmtMins = (m: number | null) => {
  if (!m) return '0m'
  const h = Math.floor(m / 60), mm = m % 60
  return h ? `${h}h ${mm}m` : `${mm}m`
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch('/api/projects?pageSize=200').then(r => r.json()),
    ]).then(([u, p]) => {
      setUsers(u.data ?? [])
      setProjects(p.data ?? [])
    })
  }, [])

  return (
    <DetailShell<Task>
      id={id} apiPath="/api/tasks" backHref="/tasks" entityLabel="task"
      title={r => r.title}
      subtitle={r => <>{r.crm_projects?.name ?? 'Standalone'} · Estimated {fmtMins(r.estimated_minutes)} · Logged {fmtMins(r.actual_minutes)}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status.replace('_', ' ')}</span>
      )}
      validate={f => !f.title?.trim() ? 'Title is required.' : null}
      buildPayload={f => ({
        title: f.title, description: f.description, status: f.status,
        priority: f.priority, due_date: f.due_date, estimated_minutes: f.estimated_minutes,
        project_id: f.project_id, assignee_id: f.assignee_id,
      })}
    >
      {(record, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.description ?? ''} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
          <div><label className={labelCls}>Priority</label>
            <Select value={form.priority ?? ''} onValueChange={v => update('priority', v)}
              options={PRIORITY.map(p => ({ value: p, label: p }))} /></div>
          <div><label className={labelCls}>Project</label>
            <Select value={form.project_id ?? ''} onValueChange={v => update('project_id', v || null as unknown as string)}
              placeholder="Standalone" allowClear clearLabel="Standalone"
              options={projects.map(p => ({ value: p.id, label: p.name }))} /></div>
          <div><label className={labelCls}>Assignee</label>
            <Select value={form.assignee_id ?? ''} onValueChange={v => update('assignee_id', v || null as unknown as string)}
              placeholder="Unassigned" allowClear clearLabel="Unassigned"
              options={users.map(u => ({ value: u.id, label: u.full_name }))} /></div>
          <div><label className={labelCls}>Due Date</label>
            <input type="date" className={inputCls} value={form.due_date ?? ''} onChange={e => update('due_date', e.target.value || null as unknown as string)} /></div>
          <div><label className={labelCls}>Estimate (mins)</label>
            <input type="number" className={inputCls} value={form.estimated_minutes ?? ''} onChange={e => update('estimated_minutes', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
          <div className="sm:col-span-2">
            <TimerControl taskId={record.id} projectId={record.project_id} status={record.status} actualMinutes={record.actual_minutes} />
          </div>
        </div>
      )}
    </DetailShell>
  )
}

function TimerControl({ taskId, projectId, status, actualMinutes }: { taskId: string; projectId: string | null; status: string; actualMinutes: number }) {
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState<{ id: string; startedAt: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    fetch('/api/time-entries/timer').then(r => r.json()).then(d => {
      if (d.data && d.data.task_id === taskId) {
        setRunning({ id: d.data.id, startedAt: d.data.started_at })
      }
    })
  }, [taskId])

  useEffect(() => {
    if (!running) return
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000)), 1000)
    return () => clearInterval(i)
  }, [running])

  async function start() {
    setBusy(true)
    try {
      const res = await fetch('/api/time-entries/timer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, project_id: projectId }),
      })
      const data = await res.json()
      if (res.ok) { setRunning({ id: data.data.id, startedAt: data.data.started_at }); toast.success('Timer started.') }
      else toast.error(data.error)
    } finally { setBusy(false) }
  }

  async function stop() {
    setBusy(true)
    try {
      const res = await fetch('/api/time-entries/timer', { method: 'DELETE' })
      if (res.ok) { setRunning(null); setElapsed(0); toast.success('Timer stopped. Refresh to see updated total.') }
      else toast.error('Failed to stop.')
    } finally { setBusy(false) }
  }

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="bg-white/3 border border-white/5 rounded-lg p-4 flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wide">Time tracking</p>
        <p className="text-white font-bold tabular-nums text-lg mt-0.5">
          {running ? formatElapsed(elapsed) : fmtMins(actualMinutes)}
        </p>
        {running && <p className="text-emerald-400 text-[10px] animate-pulse">● Running</p>}
      </div>
      {status !== 'done' && (
        running ? (
          <button onClick={stop} disabled={busy}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
            <Square className="w-4 h-4" /> Stop
          </button>
        ) : (
          <button onClick={start} disabled={busy}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
            <Play className="w-4 h-4" /> Start
          </button>
        )
      )}
    </div>
  )
}
