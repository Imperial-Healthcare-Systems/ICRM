'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, Trash2, Save, Plus, Clock, CheckSquare,
  Building2, User, Calendar, Wallet,
} from 'lucide-react' // eslint-disable-line @typescript-eslint/no-unused-vars
import clsx from 'clsx'
import Select from '@/components/ui/Select'

type Project = {
  id: string; name: string; description: string; status: string; priority: string
  start_date: string | null; end_date: string | null
  budget: number | null; currency: string; hourly_rate: number | null; is_billable: boolean
  account_id: string | null; deal_id: string | null; owner_id: string | null
  notes: string; created_at: string
  crm_accounts: { id: string; name: string } | null
  crm_users: { id: string; full_name: string } | null
  crm_deals: { id: string; title: string } | null
}

type Task = {
  id: string; title: string; status: string; priority: string
  due_date: string | null; estimated_minutes: number | null; actual_minutes: number
  position: number
  crm_users: { id: string; full_name: string } | null
}

const STATUS_OPTIONS = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  planning:  'bg-slate-500/15 text-slate-400',
  active:    'bg-emerald-500/15 text-emerald-400',
  on_hold:   'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-blue-500/15 text-blue-400',
  cancelled: 'bg-red-500/15 text-red-400',
}
const PRIORITY = ['low', 'medium', 'high', 'critical']

const TASK_COLUMNS = [
  { key: 'todo',        label: 'To Do',       color: 'border-slate-500/30' },
  { key: 'in_progress', label: 'In Progress', color: 'border-blue-500/30' },
  { key: 'review',      label: 'Review',      color: 'border-yellow-500/30' },
  { key: 'done',        label: 'Done',        color: 'border-emerald-500/30' },
] as const

const fmt = (n: number | null, c = 'INR') =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtMins = (m: number | null) => {
  if (!m) return '0m'
  const h = Math.floor(m / 60), mm = m % 60
  return h ? `${h}h ${mm}m` : `${mm}m`
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [form, setForm] = useState<Partial<Project>>({})
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`).then(r => r.json()),
      ])
      if (pRes.status === 404) { setNotFound(true); return }
      const pData = await pRes.json()
      if (!pRes.ok) { toast.error(pData.error ?? 'Failed to load.'); return }
      setProject(pData.data); setForm(pData.data)
      setTasks(tRes.data ?? [])
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  function update<K extends keyof Project>(k: K, v: Project[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.name?.trim()) { toast.error('Name is required.'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name?.trim(), description: form.description, status: form.status,
        priority: form.priority, start_date: form.start_date, end_date: form.end_date,
        budget: form.budget, currency: form.currency, hourly_rate: form.hourly_rate,
        is_billable: form.is_billable, notes: form.notes,
      }
      const res = await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed.'); return }
      toast.success('Project updated.'); load()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Project deleted.'); router.push('/projects') }
    else toast.error('Delete failed.')
  }

  async function moveTask(taskId: string, newStatus: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
  }

  if (loading) return <div className="p-6 max-w-6xl"><div className="h-8 w-64 bg-white/5 rounded animate-pulse mb-6" /><div className="h-96 bg-white/5 rounded-xl animate-pulse" /></div>
  if (notFound || !project) return <div className="p-6 max-w-2xl"><div className="bg-[#0D1B2E] border border-red-500/20 rounded-xl p-8 text-center"><p className="text-white font-semibold mb-2">Project not found</p><Link href="/projects" className="text-[#F47920] text-sm font-semibold">← Back</Link></div></div>

  const totalEstimated = tasks.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)
  const totalActual = tasks.reduce((s, t) => s + (t.actual_minutes ?? 0), 0)
  const completedTasks = tasks.filter(t => t.status === 'done').length

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push('/projects')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white shrink-0 mt-0.5"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl">{project.name}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[project.status])}>{project.status.replace('_', ' ')}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {project.crm_accounts?.name ?? 'No account'} · {project.crm_users?.full_name ?? 'No owner'} · Created {fmtDate(project.created_at)}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat icon={<CheckSquare className="w-4 h-4" />} label="Tasks" value={`${completedTasks}/${tasks.length}`} sub="completed" />
        <Stat icon={<Clock className="w-4 h-4" />} label="Time logged" value={fmtMins(totalActual)} sub={`of ${fmtMins(totalEstimated)} estimated`} />
        <Stat icon={<Wallet className="w-4 h-4" />} label="Budget" value={fmt(project.budget, project.currency)} sub={project.is_billable ? 'Billable' : 'Internal'} />
        <Stat icon={<Calendar className="w-4 h-4" />} label="Timeline" value={fmtDate(project.end_date)} sub={`Started ${fmtDate(project.start_date)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column: Tasks Kanban */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Tasks</h2>
            <button onClick={() => setShowNewTask(true)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition">
              <Plus className="w-3 h-3" /> Add Task
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TASK_COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key)
              return (
                <div key={col.key} className={clsx('bg-[#0D1B2E] border-t-2 rounded-xl p-3 min-h-[200px]', col.color)}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">{col.label}</p>
                    <span className="text-slate-500 text-[10px]">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(t => (
                      <Link key={t.id} href={`/tasks/${t.id}`}
                        className="block bg-white/3 hover:bg-white/8 border border-white/5 rounded-lg p-2.5 transition group">
                        <p className="text-white text-xs font-medium leading-snug group-hover:text-[#F47920] transition">{t.title}</p>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                          <span className={clsx('capitalize', t.priority === 'high' || t.priority === 'critical' ? 'text-orange-400' : '')}>{t.priority}</span>
                          {t.due_date && <span>{fmtDate(t.due_date)}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {t.crm_users?.full_name && <span className="text-[10px] text-slate-400 truncate">{t.crm_users.full_name}</span>}
                          {t.actual_minutes > 0 && <span className="text-[10px] text-emerald-400 ml-auto">{fmtMins(t.actual_minutes)}</span>}
                        </div>
                        {/* Quick-move buttons */}
                        <div className="flex gap-1 mt-2">
                          {TASK_COLUMNS.filter(c => c.key !== col.key).map(c => (
                            <button key={c.key} onClick={(e) => { e.preventDefault(); moveTask(t.id, c.key) }}
                              className="text-[9px] text-slate-600 hover:text-[#F47920] transition" title={`Move to ${c.label}`}>
                              → {c.label.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right sidebar: Project settings */}
        <div className="space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3">Settings</h3>
            <div className="space-y-3">
              <div><label className={labelCls}>Name *</label><input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
              <div><label className={labelCls}>Status</label>
                <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
                  options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
              <div><label className={labelCls}>Priority</label>
                <Select value={form.priority ?? ''} onValueChange={v => update('priority', v)}
                  options={PRIORITY.map(p => ({ value: p, label: p }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Start</label><input type="date" className={inputCls} value={form.start_date ?? ''} onChange={e => update('start_date', e.target.value || null as unknown as string)} /></div>
                <div><label className={labelCls}>End</label><input type="date" className={inputCls} value={form.end_date ?? ''} onChange={e => update('end_date', e.target.value || null as unknown as string)} /></div>
              </div>
              <div><label className={labelCls}>Budget (₹)</label><input type="number" className={inputCls} value={form.budget ?? ''} onChange={e => update('budget', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
              <div><label className={labelCls}>Hourly Rate (₹)</label><input type="number" className={inputCls} value={form.hourly_rate ?? ''} onChange={e => update('hourly_rate', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_billable ?? true} onChange={e => update('is_billable', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                <span className="text-white text-xs">Billable</span>
              </label>
              <div><label className={labelCls}>Notes</label>
                <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={remove} className="flex items-center gap-1 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1.5 rounded-lg transition">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>

          {/* Linked records */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5 space-y-2">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-2">Linked</h3>
            {project.crm_accounts && (
              <div className="flex items-center gap-2 text-xs"><Building2 className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-300">{project.crm_accounts.name}</span></div>
            )}
            {project.crm_deals && (
              <Link href="/deals" className="flex items-center gap-2 text-xs hover:text-[#F47920] transition"><span className="text-slate-300">{project.crm_deals.title}</span></Link>
            )}
            {project.crm_users && (
              <div className="flex items-center gap-2 text-xs"><User className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-300">{project.crm_users.full_name}</span></div>
            )}
          </div>
        </div>
      </div>

      {showNewTask && <NewTaskModal projectId={id} onClose={() => setShowNewTask(false)} onCreated={() => { setShowNewTask(false); load() }} />}
    </div>
  )
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wide mb-1">{icon}{label}</div>
      <p className="text-white font-bold">{value}</p>
      <p className="text-slate-500 text-[10px]">{sub}</p>
    </div>
  )
}

function NewTaskModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', priority: 'medium', due_date: '', estimated_minutes: '', status: 'todo' })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId, title: form.title.trim(),
          priority: form.priority, status: form.status,
          due_date: form.due_date || null,
          estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Task added.'); onCreated()
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-white font-bold text-lg mb-4">New Task</h2>
        <div className="space-y-3">
          <div><label className={labelCls}>Title *</label><input required autoFocus className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}
                options={['todo','in_progress','review','done'].map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
            <div><label className={labelCls}>Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}
                options={['low','medium','high','critical'].map(p => ({ value: p, label: p }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Due Date</label><input type="date" className={inputCls} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div><label className={labelCls}>Estimate (mins)</label><input type="number" className={inputCls} value={form.estimated_minutes} onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
