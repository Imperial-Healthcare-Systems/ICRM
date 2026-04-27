'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Account = { id: string; name: string }

export default function NewContractPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState({
    title: '', account_id: '', contract_type: 'service',
    status: 'draft', currency: 'INR',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '', value: '', auto_renew: false,
    description: '', terms: '',
  })

  useEffect(() => {
    fetch('/api/accounts?pageSize=100').then(r => r.json()).then(d => setAccounts(d.data ?? []))
  }, [])

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_id: form.account_id || null,
          end_date: form.end_date || null,
          value: form.value ? parseFloat(form.value) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Contract ${data.data.contract_number} created!`)
      router.push('/contracts')
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
      <PageHeader title="New Contract" backHref="/contracts" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Contract Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Title *</label>
              <input className={inputCls} placeholder="Annual Service Agreement" value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Account</label>
              <select className={inputCls} value={form.account_id} onChange={e => update('account_id', e.target.value)}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract Type</label>
              <select className={inputCls} value={form.contract_type} onChange={e => update('contract_type', e.target.value)}>
                {['service','maintenance','license','nda','partnership','other'].map(t => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => update('status', e.target.value)}>
                {['draft','active','expired','terminated','renewed'].map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={e => update('currency', e.target.value)}>
                {['INR','USD','EUR','GBP','AED'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={e => update('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={e => update('end_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Contract Value</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="0.00" value={form.value} onChange={e => update('value', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => update('auto_renew', !form.auto_renew)}
                className={`relative w-10 h-5 rounded-full transition ${form.auto_renew ? 'bg-[#F47920]' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.auto_renew ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-slate-300">Auto-renew</span>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <textarea rows={3} className={inputCls} placeholder="Describe the scope of this contract…" value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Terms & Conditions</label>
              <textarea rows={3} className={inputCls} placeholder="Governing terms…" value={form.terms} onChange={e => update('terms', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Contract'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
