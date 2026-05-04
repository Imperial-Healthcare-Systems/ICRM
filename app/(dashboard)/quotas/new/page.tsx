'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type User = { id: string; full_name: string }
type Territory = { id: string; name: string }

function periodDates(type: string) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (type === 'monthly') {
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  if (type === 'quarterly') {
    const q = Math.floor(m / 3)
    const start = new Date(y, q * 3, 1)
    const end = new Date(y, q * 3 + 3, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  if (type === 'yearly') {
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  return { start: '', end: '' }
}

export default function NewQuotaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [territories, setTerritories] = useState<Territory[]>([])

  const initial = periodDates('monthly')
  const [form, setForm] = useState({
    user_id: '', territory_id: '',
    period_type: 'monthly',
    period_start: initial.start, period_end: initial.end,
    target_amount: '', currency: 'INR', metric: 'revenue', notes: '',
  })

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => setUsers(d.data ?? []))
    fetch('/api/territories').then(r => r.json()).then(d => setTerritories(d.data ?? []))
  }, [])

  function update(field: string, value: string) {
    if (field === 'period_type' && value !== 'custom') {
      const dt = periodDates(value)
      setForm(f => ({ ...f, period_type: value, period_start: dt.start, period_end: dt.end }))
      return
    }
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_id) { toast.error('User is required.'); return }
    if (!form.target_amount || Number(form.target_amount) <= 0) { toast.error('Target must be positive.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/quotas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          territory_id: form.territory_id || null,
          target_amount: Number(form.target_amount),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Quota created.')
      router.push('/quotas')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Quota" backHref="/quotas" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Sales Rep *</label>
            <Select value={form.user_id} onValueChange={v => update('user_id', v)}
              options={[{ value: '', label: '— select —' }, ...users.map(u => ({ value: u.id, label: u.full_name }))]} /></div>
          <div className="col-span-2"><label className={labelCls}>Territory</label>
            <Select value={form.territory_id} onValueChange={v => update('territory_id', v)}
              options={[{ value: '', label: '— none —' }, ...territories.map(t => ({ value: t.id, label: t.name }))]} /></div>
          <div><label className={labelCls}>Metric</label>
            <Select value={form.metric} onValueChange={v => update('metric', v)}
              options={[
                { value: 'revenue', label: 'Revenue' },
                { value: 'deals_won', label: 'Deals Won' },
                { value: 'new_accounts', label: 'New Accounts' },
                { value: 'calls', label: 'Calls' },
                { value: 'meetings', label: 'Meetings' },
              ]} /></div>
          <div><label className={labelCls}>Period</label>
            <Select value={form.period_type} onValueChange={v => update('period_type', v)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'custom', label: 'Custom' },
              ]} /></div>
          <div><label className={labelCls}>Period Start *</label>
            <input required type="date" className={inputCls} value={form.period_start} onChange={e => update('period_start', e.target.value)} /></div>
          <div><label className={labelCls}>Period End *</label>
            <input required type="date" className={inputCls} value={form.period_end} onChange={e => update('period_end', e.target.value)} /></div>
          <div><label className={labelCls}>Target *</label>
            <input required type="number" min="0" step="0.01" className={inputCls} placeholder="500000"
              value={form.target_amount} onChange={e => update('target_amount', e.target.value)} /></div>
          <div><label className={labelCls}>Currency</label>
            <Select value={form.currency} onValueChange={v => update('currency', v)}
              options={['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => ({ value: c, label: c }))} /></div>
          <div className="col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' min-h-[60px] resize-y'} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Quota'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
