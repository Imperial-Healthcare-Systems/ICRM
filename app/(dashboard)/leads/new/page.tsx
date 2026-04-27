'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    company: '', job_title: '', lead_source: '', lead_status: 'new',
    rating: 'warm', notes: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Lead created!')
      router.push('/leads')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Lead" backHref="/leads" />

      <form onSubmit={handleSubmit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input required className={inputCls} placeholder="John" value={form.first_name} onChange={e => update('first_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input className={inputCls} placeholder="Doe" value={form.last_name} onChange={e => update('last_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} placeholder="john@company.com" value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} placeholder="+91 98765 43210" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Company</label>
            <input className={inputCls} placeholder="Acme Corp" value={form.company} onChange={e => update('company', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Job Title</label>
            <input className={inputCls} placeholder="CEO" value={form.job_title} onChange={e => update('job_title', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Lead Source</label>
            <select className={inputCls} value={form.lead_source} onChange={e => update('lead_source', e.target.value)}>
              <option value="">Select source</option>
              {['Website','Referral','Cold Call','Email Campaign','LinkedIn','WhatsApp','Exhibition','Partner','Other'].map(s => (
                <option key={s} value={s.toLowerCase().replace(' ', '_')}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rating</label>
            <select className={inputCls} value={form.rating} onChange={e => update('rating', e.target.value)}>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🌡️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.lead_status} onChange={e => update('lead_status', e.target.value)}>
              {['new','contacted','qualified','unqualified'].map(s => (
                <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            rows={3}
            className={inputCls}
            placeholder="Any additional notes about this lead…"
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Lead'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
