'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import Select from '@/components/ui/Select'
import clsx from 'clsx'

type Product = {
  id: string; name: string; sku: string | null; description: string
  unit_price: number; currency: string; tax_pct: number
  category: string | null; unit: string; is_active: boolean
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Product>
      id={id} apiPath="/api/products" backHref="/products" entityLabel="product"
      title={r => r.name}
      subtitle={r => <>{fmt(r.unit_price, r.currency)} per {r.unit} · {r.tax_pct}% tax</>}
      badges={r => !r.is_active ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-500/15 text-slate-400">Inactive</span> : null}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>SKU</label>
            <input className={inputCls} value={form.sku ?? ''} onChange={e => update('sku', e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <input className={inputCls} value={form.category ?? ''} onChange={e => update('category', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description</label>
            <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.description ?? ''} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Unit Price (₹)</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={form.unit_price ?? 0} onChange={e => update('unit_price', Number(e.target.value))} /></div>
          <div><label className={labelCls}>Tax %</label>
            <input type="number" min="0" max="100" step="0.01" className={inputCls} value={form.tax_pct ?? 0} onChange={e => update('tax_pct', Number(e.target.value))} /></div>
          <div><label className={labelCls}>Unit</label>
            <Select value={form.unit ?? 'unit'} onValueChange={v => update('unit', v)}
              options={['unit', 'hour', 'day', 'month', 'year', 'license', 'kg', 'piece'].map(u => ({ value: u, label: u }))} /></div>
          <div><label className={labelCls}>Currency</label>
            <Select value={form.currency ?? 'INR'} onValueChange={v => update('currency', v)}
              options={['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => ({ value: c, label: c }))} /></div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active ?? true} onChange={e => update('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
              <span className="text-white text-sm">Active (available in catalog)</span>
            </label>
          </div>
        </div>
      )}
    </DetailShell>
  )
}
