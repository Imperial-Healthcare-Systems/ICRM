'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Stage = { id: string; name: string }
type Account = { id: string; name: string }

export default function NewDealPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState({
    title: '', deal_value: '', stage_id: '', account_id: '',
    probability: '0', expected_close: '', currency: 'INR',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline-stages').then(r => r.json()),
      fetch('/api/accounts?pageSize=100').then(r => r.json()),
    ]).then(([s, a]) => {
      setStages(s.data ?? [])
      setAccounts(a.data ?? [])
      if (s.data?.[0]) setForm(f => ({ ...f, stage_id: s.data[0].id }))
    })
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          deal_value: Number(form.deal_value) || 0,
          probability: Number(form.probability) || 0,
          account_id: form.account_id || null,
          expected_close: form.expected_close || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Deal created!')
      router.push('/deals')
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
      <PageHeader title="New Deal" backHref="/deals" />
      <form onSubmit={handleSubmit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Deal Title *</label>
            <input required className={inputCls} placeholder="Acme Corp — Enterprise Plan" value={form.title} onChange={e => update('title', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Deal Value (₹) *</label>
            <input required type="number" min="0" className={inputCls} placeholder="150000" value={form.deal_value} onChange={e => update('deal_value', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Probability (%)</label>
            <input type="number" min="0" max="100" className={inputCls} placeholder="50" value={form.probability} onChange={e => update('probability', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Pipeline Stage</label>
            <Select value={form.stage_id} onValueChange={v => update('stage_id', v)}
              placeholder="Select stage"
              options={stages.map(s => ({ value: s.id, label: s.name }))} />
          </div>
          <div>
            <label className={labelCls}>Account</label>
            <Select value={form.account_id} onValueChange={v => update('account_id', v)}
              placeholder="Select account" allowClear clearLabel="No account"
              options={accounts.map(a => ({ value: a.id, label: a.name }))} />
          </div>
          <div>
            <label className={labelCls}>Expected Close Date</label>
            <input type="date" className={inputCls} value={form.expected_close} onChange={e => update('expected_close', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <Select value={form.currency} onValueChange={v => update('currency', v)}
              options={['INR','USD','EUR','GBP','AED'].map(c => ({ value: c, label: c }))} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Deal'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
