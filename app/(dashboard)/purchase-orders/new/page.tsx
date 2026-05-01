'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import LineItemsEditor, { LineItem, computeTotals } from '@/components/LineItemsEditor'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

import Select from '@/components/ui/Select'
type Vendor = { id: string; name: string }

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [items, setItems] = useState<LineItem[]>([])
  const [taxPct, setTaxPct] = useState(18)
  const [discountPct, setDiscountPct] = useState(0)

  const [form, setForm] = useState({
    vendor_id: '', currency: 'INR',
    issue_date: new Date().toISOString().split('T')[0],
    expected_delivery: '', notes: '', terms: 'Payment due on delivery.',
  })

  useEffect(() => {
    fetch('/api/vendors?pageSize=100').then(r => r.json()).then(d => setVendors(d.data ?? []))
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { toast.error('Add at least one line item.'); return }
    setLoading(true)
    const { subtotal, total } = computeTotals(items, discountPct, taxPct)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          vendor_id: form.vendor_id || null,
          expected_delivery: form.expected_delivery || null,
          items, subtotal, discount_pct: discountPct, tax_pct: taxPct, total,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Purchase Order ${data.data.po_number} created!`)
      router.push('/purchase-orders')
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
      <PageHeader title="New Purchase Order" backHref="/purchase-orders" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Order Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>Vendor</label>
              <Select value={form.vendor_id} onValueChange={v => update('vendor_id', v)} placeholder="Select vendor" allowClear clearLabel="Select vendor"
              options={vendors.map(v => ({ value: v.id, label: v.name }))} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <Select value={form.currency} onValueChange={v => update('currency', v)}
              options={['INR','USD','EUR','GBP','AED'].map(c => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" className={inputCls} value={form.issue_date} onChange={e => update('issue_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Expected Delivery</label>
              <input type="date" className={inputCls} value={form.expected_delivery} onChange={e => update('expected_delivery', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <LineItemsEditor items={items} onChange={setItems} taxPct={taxPct} onTaxChange={setTaxPct} discountPct={discountPct} onDiscountChange={setDiscountPct} currency={form.currency} />
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={3} className={inputCls} placeholder="Delivery instructions or notes…" value={form.notes} onChange={e => update('notes', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Terms</label>
            <textarea rows={3} className={inputCls} value={form.terms} onChange={e => update('terms', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Purchase Order'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
