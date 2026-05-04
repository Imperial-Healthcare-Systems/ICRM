'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Mail, Save, Loader2, UserPlus, Clock, Play, Pause, Archive, X } from 'lucide-react'
import clsx from 'clsx'
import Select from '@/components/ui/Select'

type Step = { id: string; step_order: number; delay_days: number; subject: string; body?: string }
type Sequence = {
  id: string; name: string; description: string; status: string; created_at: string
  crm_email_sequence_steps: Step[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-yellow-500/15 text-yellow-400',
  archived: 'bg-slate-600/15 text-slate-500',
}

export default function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [seq, setSeq] = useState<Sequence | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/email-sequences/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setSeq(data.data)
      setForm({ name: data.data.name, description: data.data.description ?? '' })
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/email-sequences/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description }),
      })
      if (res.ok) { toast.success('Saved.'); load() }
      else toast.error('Save failed.')
    } finally { setSaving(false) }
  }

  async function changeStatus(newStatus: string) {
    const res = await fetch(`/api/email-sequences/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { toast.success(`Sequence ${newStatus}.`); load() }
    else toast.error('Status change failed.')
  }

  async function remove() {
    if (!confirm('Delete this sequence? Active enrollments will stop.')) return
    const res = await fetch(`/api/email-sequences/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted.'); router.push('/email-sequences') }
    else toast.error('Delete failed.')
  }

  if (loading) return <div className="p-6 max-w-4xl"><div className="h-8 w-64 bg-white/5 rounded animate-pulse" /></div>
  if (notFound || !seq) return <div className="p-6"><Link href="/email-sequences" className="text-[#F47920]">← Back</Link></div>

  const steps = (seq.crm_email_sequence_steps ?? []).sort((a, b) => a.step_order - b.step_order)
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push('/email-sequences')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white shrink-0"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl">{seq.name}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[seq.status])}>{seq.status}</span>
          </div>
          {seq.description && <p className="text-slate-500 text-xs mt-0.5">{seq.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowEnroll(true)} className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold px-4 py-2 rounded-lg text-sm transition">
            <UserPlus className="w-4 h-4" /> Enroll
          </button>
          {seq.status === 'draft' && (
            <button onClick={() => changeStatus('active')} className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              <Play className="w-4 h-4" /> Activate
            </button>
          )}
          {seq.status === 'active' && (
            <button onClick={() => changeStatus('paused')} className="flex items-center gap-1.5 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 font-semibold px-4 py-2 rounded-lg text-sm transition">
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {seq.status === 'paused' && (
            <button onClick={() => changeStatus('active')} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          {seq.status !== 'archived' && (
            <button onClick={() => changeStatus('archived')} className="flex items-center gap-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 font-medium px-4 py-2 rounded-lg text-sm transition">
              <Archive className="w-4 h-4" /> Archive
            </button>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Steps</h2>
          <button onClick={() => setShowAddStep(true)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            <Plus className="w-3 h-3" /> Add Step
          </button>
        </div>
        {steps.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">No steps yet. Add at least one step before activating.</p>
        ) : (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F47920]/15 flex items-center justify-center text-[#F47920] font-bold text-sm shrink-0">{step.step_order}</div>
                <div className="flex-1 bg-white/3 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase tracking-wide mb-1">
                    <Clock className="w-3 h-3" />
                    {i === 0 ? 'On enrollment' : `${step.delay_days} day${step.delay_days === 1 ? '' : 's'} after step ${step.step_order - 1}`}
                  </div>
                  <p className="text-white font-semibold text-sm">{step.subject}</p>
                  {step.body && <p className="text-slate-400 text-xs mt-1 line-clamp-2 whitespace-pre-wrap">{step.body}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold text-sm mb-4">Settings</h2>
        <div className="space-y-4">
          <div><label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelCls}>Description</label>
            <textarea rows={3} className={inputCls + ' resize-y'} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={remove} className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {showAddStep && <AddStepModal sequenceId={id} nextOrder={steps.length + 1} onClose={() => setShowAddStep(false)} onAdded={() => { setShowAddStep(false); load() }} />}
      {showEnroll && <EnrollModal sequenceId={id} canEnroll={seq.status === 'active'} onClose={() => setShowEnroll(false)} />}
    </div>
  )
}

function AddStepModal({ sequenceId, nextOrder, onClose, onAdded }: { sequenceId: string; nextOrder: number; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ subject: '', body: '', delay_days: nextOrder === 1 ? '0' : '1' })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.body.trim()) { toast.error('Subject and body required.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/email-sequences/${sequenceId}/steps`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: form.subject, body: form.body, delay_days: Number(form.delay_days) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Step added.'); onAdded()
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Add Step #{nextOrder}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className={labelCls}>Delay (days after previous step)</label>
            <input type="number" min="0" className={inputCls} value={form.delay_days} onChange={e => setForm(f => ({ ...f, delay_days: e.target.value }))} disabled={nextOrder === 1} />
            {nextOrder === 1 && <p className="text-slate-500 text-[10px] mt-1">First step is sent immediately on enrollment.</p>}
          </div>
          <div><label className={labelCls}>Subject *</label>
            <input required autoFocus className={inputCls} placeholder="Welcome to {{company}}!" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div><label className={labelCls}>Email body * (Markdown / HTML allowed)</label>
            <textarea required rows={10} className={inputCls + ' resize-y font-mono text-xs leading-relaxed'} placeholder={'Hi {{first_name}},\n\nThanks for signing up...'}
              value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Adding…' : 'Add Step'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EnrollModal({ sequenceId, canEnroll, onClose }: { sequenceId: string; canEnroll: boolean; onClose: () => void }) {
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [contactId, setContactId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/contacts?pageSize=200').then(r => r.json()).then(d => setContacts(d.data ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactId) { toast.error('Pick a contact.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/email-sequences/${sequenceId}/enroll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Contact enrolled. First step queued for hourly cron.')
      onClose()
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-400" /> Enroll Contact</h2>
        {!canEnroll && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-yellow-300 text-xs">Sequence must be <strong>active</strong> to enroll contacts.</div>}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact</label>
          <Select value={contactId} onValueChange={setContactId} placeholder="Pick a contact"
            options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name ?? ''}`.trim() }))} />
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting || !canEnroll} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Enroll
          </button>
        </div>
      </form>
    </div>
  )
}
