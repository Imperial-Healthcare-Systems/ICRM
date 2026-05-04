'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', sku: '', description: '',
    unit_price: '', currency: 'INR', tax_pct: '18',
    category: '', unit: 'unit',
  })

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          unit_price: Number(form.unit_price) || 0,
          tax_pct: Number(form.tax_pct) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Product created.')
      router.push(`/products/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Product" backHref="/products" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Name *</label>
            <input required className={inputCls} placeholder="Imperial CRM Enterprise Plan" value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>SKU</label>
            <input className={inputCls} placeholder="ICRM-ENT-01" value={form.sku} onChange={e => update('sku', e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <input className={inputCls} placeholder="Software / Services" value={form.category} onChange={e => update('category', e.target.value)} /></div>
          <div className="col-span-2"><label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Unit Price (₹) *</label>
            <input required type="number" min="0" step="0.01" className={inputCls} placeholder="24999" value={form.unit_price} onChange={e => update('unit_price', e.target.value)} /></div>
          <div><label className={labelCls}>Tax %</label>
            <input type="number" min="0" max="100" step="0.01" className={inputCls} value={form.tax_pct} onChange={e => update('tax_pct', e.target.value)} /></div>
          <div><label className={labelCls}>Unit</label>
            <Select value={form.unit} onValueChange={v => update('unit', v)}
              options={['unit', 'hour', 'day', 'month', 'year', 'license', 'kg', 'piece'].map(u => ({ value: u, label: u }))} /></div>
          <div><label className={labelCls}>Currency</label>
            <Select value={form.currency} onValueChange={v => update('currency', v)}
              options={['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => ({ value: c, label: c }))} /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Product'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
