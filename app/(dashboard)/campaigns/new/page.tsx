'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'email', subject: '', body: '',
    from_name: 'Imperial CRM', scheduled_at: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    if (form.type === 'email' && !form.subject?.trim()) { toast.error('Subject is required for email campaigns.'); return }
    if (!form.body?.trim()) { toast.error('Campaign body is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          scheduled_at: form.scheduled_at || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Campaign created as draft!')
      router.push('/campaigns')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="New Campaign" backHref="/campaigns" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Campaign Setup</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Campaign Name *</label>
              <input className={inputCls} placeholder="Q2 Product Launch" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={form.type} onChange={e => update('type', e.target.value)}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Schedule (optional)</label>
              <input type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={e => update('scheduled_at', e.target.value)} />
            </div>
            {form.type === 'email' && (
              <>
                <div>
                  <label className={labelCls}>From Name</label>
                  <input className={inputCls} placeholder="Imperial CRM" value={form.from_name} onChange={e => update('from_name', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Subject *</label>
                  <input className={inputCls} placeholder="Exciting news from us!" value={form.subject} onChange={e => update('subject', e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">
            {form.type === 'email' ? 'Email Body' : form.type === 'whatsapp' ? 'WhatsApp Message' : 'SMS Message'}
          </h3>
          <textarea
            rows={10}
            className={inputCls}
            placeholder={
              form.type === 'email'
                ? 'Write your email content here. You can use plain text or HTML.'
                : form.type === 'whatsapp'
                ? 'Write your WhatsApp message. Use *bold*, _italic_.'
                : 'Write your SMS (max 160 chars for single message).'
            }
            value={form.body}
            onChange={e => update('body', e.target.value)}
          />
          {form.type === 'sms' && (
            <p className="text-slate-500 text-xs mt-1.5">{form.body.length} / 160 characters</p>
          )}
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4">
          <p className="text-slate-500 text-xs">
            Campaign will be saved as <span className="text-white font-semibold">Draft</span>. You can review and send it from the campaign detail page. Recipients are selected at send time via segment filters.
          </p>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Save as Draft'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
