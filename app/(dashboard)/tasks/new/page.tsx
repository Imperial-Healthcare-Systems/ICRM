'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({
    title: '', description: '', project_id: '', assignee_id: '',
    status: 'todo', priority: 'medium',
    due_date: '', estimated_minutes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/projects?pageSize=200').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([p, u]) => {
      setProjects(p.data ?? [])
      setUsers(u.data ?? [])
    })
  }, [])

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_id: form.project_id || null,
          assignee_id: form.assignee_id || null,
          due_date: form.due_date || null,
          estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Task created!')
      router.push(`/tasks/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Task" backHref="/tasks" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Title *</label>
            <input required className={inputCls} placeholder="Design new homepage hero" value={form.title} onChange={e => update('title', e.target.value)} /></div>
          <div className="col-span-2"><label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Project</label>
            <Select value={form.project_id} onValueChange={v => update('project_id', v)}
              placeholder="Standalone" allowClear clearLabel="Standalone (no project)"
              options={projects.map(p => ({ value: p.id, label: p.name }))} /></div>
          <div><label className={labelCls}>Assignee</label>
            <Select value={form.assignee_id} onValueChange={v => update('assignee_id', v)}
              placeholder="Unassigned" allowClear clearLabel="Unassigned"
              options={users.map(u => ({ value: u.id, label: u.full_name }))} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status} onValueChange={v => update('status', v)}
              options={['todo','in_progress','review','done'].map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
          <div><label className={labelCls}>Priority</label>
            <Select value={form.priority} onValueChange={v => update('priority', v)}
              options={['low','medium','high','critical'].map(p => ({ value: p, label: p }))} /></div>
          <div><label className={labelCls}>Due Date</label>
            <input type="date" className={inputCls} value={form.due_date} onChange={e => update('due_date', e.target.value)} /></div>
          <div><label className={labelCls}>Estimate (mins)</label>
            <input type="number" min="0" className={inputCls} placeholder="120" value={form.estimated_minutes} onChange={e => update('estimated_minutes', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Task'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
