'use client'

import { useEffect, useState } from 'react'
import { Building2, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type OrgData = {
  id: string; name: string; billing_email: string; phone: string
  website: string; gstin: string; pan: string
  address: string; logo_url: string; plan_tier: string; subscription_status: string
}

export default function OrganisationSettings() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [form, setForm] = useState<Partial<OrgData>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings/organisation').then(r => r.json()).then(d => {
      setOrg(d.data)
      setForm(d.data ?? {})
      setLoading(false)
    })
  }, [])

  function update(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Organisation updated.')
    } catch { toast.error('Something went wrong.') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition disabled:opacity-40'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  if (loading) return <div className="p-8"><div className="h-64 bg-white/3 rounded-xl animate-pulse" /></div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="w-5 h-5 text-[#F47920]" />
        <div>
          <h1 className="text-white font-bold text-xl">Organisation</h1>
          <p className="text-slate-500 text-sm">Update your company profile and legal details.</p>
        </div>
      </div>

      {/* Plan info (read-only) */}
      <div className="flex gap-3">
        <div className="bg-[#F47920]/10 border border-[#F47920]/20 rounded-xl px-4 py-2 text-center">
          <p className="text-[#F47920] font-bold text-sm capitalize">{org?.plan_tier ?? '—'}</p>
          <p className="text-slate-500 text-xs">Plan</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-center">
          <p className="text-emerald-400 font-bold text-sm capitalize">{org?.subscription_status ?? '—'}</p>
          <p className="text-slate-500 text-xs">Status</p>
        </div>
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Organisation Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} placeholder="Imperial Tech Innovations Pvt Ltd" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={form.billing_email ?? ''} disabled placeholder="contact@company.com" />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={form.website ?? ''} onChange={e => update('website', e.target.value)} placeholder="https://company.com" />
          </div>
          <div>
            <label className={labelCls}>Logo URL</label>
            <input className={inputCls} value={form.logo_url ?? ''} onChange={e => update('logo_url', e.target.value)} placeholder="https://cdn.company.com/logo.png" />
          </div>
          <div>
            <label className={labelCls}>GSTIN</label>
            <input className={inputCls} value={form.gstin ?? ''} onChange={e => update('gstin', e.target.value)} placeholder="06AAICI5025Q1Z6" />
          </div>
          <div>
            <label className={labelCls}>PAN</label>
            <input className={inputCls} value={form.pan ?? ''} onChange={e => update('pan', e.target.value)} placeholder="AAICI5025Q" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Registered Address</label>
            <textarea rows={2} className={inputCls} value={form.address ?? ''} onChange={e => update('address', e.target.value)} placeholder="123, Business Park, City, State — 110001" />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
