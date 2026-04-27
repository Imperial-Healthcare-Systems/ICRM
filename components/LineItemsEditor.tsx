'use client'

import { Plus, Trash2 } from 'lucide-react'

export type LineItem = {
  description: string
  qty: number
  rate: number
  discount_pct: number
  amount: number
}

interface LineItemsEditorProps {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  taxPct: number
  onTaxChange: (v: number) => void
  discountPct: number
  onDiscountChange: (v: number) => void
  currency?: string
}

function calcAmount(item: LineItem) {
  const base = item.qty * item.rate
  return base - base * (item.discount_pct / 100)
}

function fmt(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
}

export function computeTotals(items: LineItem[], discountPct: number, taxPct: number) {
  const subtotal = items.reduce((s, i) => s + calcAmount(i), 0)
  const discountAmt = subtotal * (discountPct / 100)
  const taxable = subtotal - discountAmt
  const taxAmt = taxable * (taxPct / 100)
  const total = taxable + taxAmt
  return { subtotal, discountAmt, taxAmt, total }
}

export default function LineItemsEditor({
  items, onChange, taxPct, onTaxChange, discountPct, onDiscountChange, currency = 'INR',
}: LineItemsEditorProps) {
  function addItem() {
    onChange([...items, { description: '', qty: 1, rate: 0, discount_pct: 0, amount: 0 }])
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    const updated = items.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, [field]: value }
      next.amount = calcAmount(next)
      return next
    })
    onChange(updated)
  }

  const { subtotal, discountAmt, taxAmt, total } = computeTotals(items, discountPct, taxPct)

  const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition w-full'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-300 text-sm font-semibold">Line Items</h3>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-[#F47920] hover:text-[#e06810] text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      {/* Header */}
      <div className="hidden md:grid grid-cols-[3fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1">
        <span>Description</span>
        <span>Qty</span>
        <span>Rate</span>
        <span>Disc %</span>
        <span>Amount</span>
        <span />
      </div>

      {items.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-white/10 rounded-xl">
          No items — click &quot;Add Item&quot; to start
        </div>
      )}

      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
          <input
            className={inputCls}
            placeholder="Item description / service name"
            value={item.description}
            onChange={e => updateItem(idx, 'description', e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            placeholder="1"
            value={item.qty || ''}
            onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            placeholder="0.00"
            value={item.rate || ''}
            onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
          />
          <input
            type="number"
            min="0"
            max="100"
            className={inputCls}
            placeholder="0"
            value={item.discount_pct || ''}
            onChange={e => updateItem(idx, 'discount_pct', Number(e.target.value))}
          />
          <div className="text-[#F47920] font-semibold text-sm text-right">
            {fmt(calcAmount(item), currency)}
          </div>
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Totals */}
      <div className="border-t border-white/10 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Subtotal</span>
          <span className="text-white font-medium">{fmt(subtotal, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Discount</span>
            <input
              type="number" min="0" max="100"
              value={discountPct || ''}
              onChange={e => onDiscountChange(Number(e.target.value))}
              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#F47920]/60 text-center"
              placeholder="0"
            />
            <span className="text-slate-500 text-xs">%</span>
          </div>
          <span className="text-red-400">- {fmt(discountAmt, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tax (GST)</span>
            <input
              type="number" min="0" max="100"
              value={taxPct || ''}
              onChange={e => onTaxChange(Number(e.target.value))}
              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#F47920]/60 text-center"
              placeholder="18"
            />
            <span className="text-slate-500 text-xs">%</span>
          </div>
          <span className="text-slate-300">+ {fmt(taxAmt, currency)}</span>
        </div>
        <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2">
          <span className="text-white">Total</span>
          <span className="text-[#F47920]">{fmt(total, currency)}</span>
        </div>
      </div>
    </div>
  )
}
