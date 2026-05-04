'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewSubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; unit_price: number; tax_pct: number }[]>([])
  const [form, setForm] = useState({
    name: '', description: '',
    account_id: '', contact_id: '', product_id: '',
    amount: '', currency: 'INR', tax_pct: '18',
    billing_cycle: 'monthly', cycle_days: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    next_billing_date: new Date().toISOString().split('T')[0],
    payment_terms_days: '7',
    auto_renew: true, notes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?pageSize=200').then(r => r.json()),
      fetch('/api/products?pageSize=200').then(r => r.json()),
    ]).then(([a, p]) => {
      setAccounts(a.data ?? [])
      setProducts(p.data ?? [])
    })
  }, [])

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  // Auto-fill price/tax when product selected
  useEffect(() => {
    if (!form.product_id) return
    const p = products.find(x => x.id === form.product_id)
    if (p) {
      setForm(f => ({
        ...f,
        amount: f.amount || String(p.unit_price),
        tax_pct: f.tax_pct || String(p.tax_pct),
        name: f.name || p.name,
      }))
    }
  }, [form.product_id, products])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required.'); return }
    if (!form.account_id) { toast.error('Account required.'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Amount must be positive.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          tax_pct: Number(form.tax_pct) || 0,
          cycle_days: form.cycle_days ? Number(form.cycle_days) : null,
          payment_terms_days: Number(form.payment_terms_days) || 7,
          end_date: form.end_date || null,
          contact_id: form.contact_id || null,
          product_id: form.product_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Subscription ${data.data.subscription_number} created.`)
      router.push(`/subscriptions/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Subscription" backHref="/subscriptions" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Name *</label>
            <input required className={inputCls} placeholder="Monthly Retainer · Acme Corp" value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>Account *</label>
            <Select value={form.account_id} onValueChange={v => update('account_id', v)} placeholder="Select account"
              options={accounts.map(a => ({ value: a.id, label: a.name }))} /></div>
          <div><label className={labelCls}>Product (optional)</label>
            <Select value={form.product_id} onValueChange={v => update('product_id', v)} placeholder="No product link" allowClear clearLabel="No product"
              options={products.map(p => ({ value: p.id, label: p.name }))} /></div>
          <div><label className={labelCls}>Amount *</label>
            <input required type="number" min="0.01" step="0.01" className={inputCls} placeholder="24999" value={form.amount} onChange={e => update('amount', e.target.value)} /></div>
          <div><label className={labelCls}>Tax %</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={form.tax_pct} onChange={e => update('tax_pct', e.target.value)} /></div>
          <div><label className={labelCls}>Billing Cycle</label>
            <Select value={form.billing_cycle} onValueChange={v => update('billing_cycle', v)}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'half_yearly', label: 'Half-yearly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'custom', label: 'Custom (days)' },
              ]} /></div>
          {form.billing_cycle === 'custom' && (
            <div><label className={labelCls}>Cycle Days *</label>
              <input type="number" min="1" className={inputCls} value={form.cycle_days} onChange={e => update('cycle_days', e.target.value)} placeholder="30" /></div>
          )}
          <div><label className={labelCls}>Start Date *</label>
            <input required type="date" className={inputCls} value={form.start_date} onChange={e => { update('start_date', e.target.value); update('next_billing_date', e.target.value) }} /></div>
          <div><label className={labelCls}>End Date (optional)</label>
            <input type="date" className={inputCls} value={form.end_date} onChange={e => update('end_date', e.target.value)} /></div>
          <div><label className={labelCls}>Next Billing Date *</label>
            <input required type="date" className={inputCls} value={form.next_billing_date} onChange={e => update('next_billing_date', e.target.value)} /></div>
          <div><label className={labelCls}>Payment Terms (days)</label>
            <input type="number" min="0" className={inputCls} value={form.payment_terms_days} onChange={e => update('payment_terms_days', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_renew} onChange={e => update('auto_renew', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
              <span className="text-white text-sm">Auto-renew when end_date is reached</span>
            </label>
          </div>
          <div className="col-span-2"><label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.description} onChange={e => update('description', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Subscription'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
