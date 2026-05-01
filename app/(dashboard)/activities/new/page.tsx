'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

import Select from '@/components/ui/Select'
export default function NewActivityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'call', subject: '', description: '',
    due_date: '', duration_mins: '',
    related_to_type: '', related_to_id: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
          due_date: form.due_date || null,
          related_to_type: form.related_to_type || null,
          related_to_id: form.related_to_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Activity logged!')
      router.push('/activities')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  const TYPES = ['call','email','meeting','task','note','demo','follow_up']

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Log Activity" backHref="/activities" />
      <form onSubmit={handleSubmit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div>
          <label className={labelCls}>Activity Type *</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => update('activity_type', t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                  form.activity_type === t
                    ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Subject *</label>
            <input required className={inputCls} placeholder="Call with Acme Corp about renewal" value={form.subject} onChange={e => update('subject', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Due Date & Time</label>
            <input type="datetime-local" className={inputCls} value={form.due_date} onChange={e => update('due_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Duration (minutes)</label>
            <input type="number" className={inputCls} placeholder="30" value={form.duration_mins} onChange={e => update('duration_mins', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Related To</label>
            <Select value={form.related_to_type} onValueChange={v => update('related_to_type', v)} placeholder="Not linked" allowClear clearLabel="Not linked"
              options={[{ value: 'lead', label: "Lead" }, { value: 'contact', label: "Contact" }, { value: 'account', label: "Account" }, { value: 'deal', label: "Deal" }]} />
          </div>
          {form.related_to_type && (
            <div>
              <label className={labelCls}>Record ID</label>
              <input className={inputCls} placeholder="Paste the ID…" value={form.related_to_id} onChange={e => update('related_to_id', e.target.value)} />
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea rows={3} className={inputCls} placeholder="What happened or needs to happen…" value={form.description} onChange={e => update('description', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Log Activity'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
