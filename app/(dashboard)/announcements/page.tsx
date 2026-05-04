'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, Plus, Pin, Trash2, X, Loader2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Announcement = {
  id: string; title: string; body: string; category: string; audience: string
  is_pinned: boolean; starts_at: string; ends_at: string | null
  crm_users: { full_name: string } | null
  created_at: string
}

const CATEGORY_COLORS: Record<string, string> = {
  general:     'bg-slate-500/15 text-slate-300',
  feature:     'bg-blue-500/15 text-blue-400',
  maintenance: 'bg-yellow-500/15 text-yellow-400',
  policy:      'bg-purple-500/15 text-purple-400',
  event:       'bg-emerald-500/15 text-emerald-400',
  urgent:      'bg-red-500/15 text-red-400',
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/announcements')
      const data = await res.json()
      setItems(data.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted.'); fetchAll() }
    else toast.error('Delete failed.')
  }

  async function togglePin(a: Announcement) {
    await fetch(`/api/announcements/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !a.is_pinned }),
    })
    fetchAll()
  }

  return (
    <div className="p-6 mx-auto max-w-4xl">
      <PageHeader
        kicker="Engagement"
        title="Announcements"
        subtitle={`${items.length} total`}
        actions={<Button onClick={() => setShowNew(true)} icon={<Plus className="w-4 h-4" />}>New Announcement</Button>}
      />

      {loading ? <Skeleton className="h-32 rounded-xl" /> :
        items.length === 0 ? (
          <div className="surface-premium">
            <EmptyState icon={<Bell className="w-7 h-7" />} title="No announcements"
              description="Broadcast updates to your team — features, maintenance windows, policy changes."
              actionLabel="New Announcement" onAction={() => setShowNew(true)} />
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(a => (
              <div key={a.id} className={clsx(
                'bg-[#0D1B2E] border rounded-xl p-5 relative',
                a.is_pinned ? 'border-[#F47920]/40' : 'border-white/5'
              )}>
                {a.is_pinned && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[#F47920] text-[10px] font-bold uppercase tracking-wider">
                    <Pin className="w-3 h-3" /> Pinned
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', CATEGORY_COLORS[a.category])}>
                    {a.category}
                  </span>
                  <span className="text-slate-500 text-[10px]">For: {a.audience}</span>
                  <span className="text-slate-600 text-[10px]">·</span>
                  <span className="text-slate-500 text-[10px]">{fmtDate(a.starts_at)}</span>
                  {a.ends_at && <span className="text-slate-500 text-[10px]">→ {fmtDate(a.ends_at)}</span>}
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">{a.title}</h3>
                <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{a.body}</p>
                {a.crm_users?.full_name && <p className="text-slate-500 text-[10px] mt-3">— {a.crm_users.full_name}</p>}
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <button onClick={() => togglePin(a)} className="flex items-center gap-1 text-slate-400 hover:text-[#F47920] text-xs font-medium">
                    <Pin className="w-3 h-3" /> {a.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button onClick={() => remove(a.id)} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {showNew && <NewAnnouncementModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchAll() }} />}
    </div>
  )
}

function NewAnnouncementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', body: '', category: 'general', audience: 'all',
    is_pinned: false, ends_at: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and body required.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Announcement posted.'); onCreated()
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-[#F47920]" /> New Announcement</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className={labelCls}>Title *</label>
            <input required autoFocus className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className={labelCls}>Message *</label>
            <textarea required rows={6} className={inputCls + ' resize-y'} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}
                options={['general', 'feature', 'maintenance', 'policy', 'event', 'urgent'].map(c => ({ value: c, label: c }))} /></div>
            <div><label className={labelCls}>Audience</label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}
                options={['all', 'admins', 'sales', 'support', 'finance'].map(a => ({ value: a, label: a }))} /></div>
          </div>
          <div><label className={labelCls}>Expires (optional)</label>
            <input type="datetime-local" className={inputCls} value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
            <span className="text-white text-xs">Pin to top</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
