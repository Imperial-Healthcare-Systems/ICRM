'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', website: '', industry: '', account_type: 'prospect',
    phone: '', email: '', annual_revenue: '', employee_count: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null,
          employee_count: form.employee_count ? Number(form.employee_count) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Account created!')
      router.push('/accounts')
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
      <PageHeader title="New Account" backHref="/accounts" />
      <form onSubmit={handleSubmit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Company Name *</label>
            <input required className={inputCls} placeholder="Acme Corp" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} placeholder="https://acme.com" value={form.website} onChange={e => update('website', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Industry</label>
            <input className={inputCls} placeholder="Technology" value={form.industry} onChange={e => update('industry', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Account Type</label>
            <select className={inputCls} value={form.account_type} onChange={e => update('account_type', e.target.value)}>
              {['prospect','customer','partner','vendor','other'].map(t => (
                <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} placeholder="+91 11 2345 6789" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} placeholder="info@acme.com" value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Annual Revenue (₹)</label>
            <input type="number" className={inputCls} placeholder="5000000" value={form.annual_revenue} onChange={e => update('annual_revenue', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Employee Count</label>
            <input type="number" className={inputCls} placeholder="50" value={form.employee_count} onChange={e => update('employee_count', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Account'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
