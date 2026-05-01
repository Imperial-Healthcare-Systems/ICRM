'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type LineItem = { description: string; qty: number; rate: number; total: number }
type PO = {
  id: string; po_number: string; status: string
  issue_date: string; expected_date: string | null; received_date: string | null
  items: LineItem[]; subtotal: number; tax_pct: number; total: number
  currency: string; notes: string; vendor_id: string | null
  crm_vendors: { name: string } | null
  created_at: string
}

const STATUS_OPTIONS = ['draft', 'sent', 'acknowledged', 'partially_received', 'received', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400', sent: 'bg-blue-500/15 text-blue-400',
  acknowledged: 'bg-purple-500/15 text-purple-400',
  partially_received: 'bg-yellow-500/15 text-yellow-400',
  received: 'bg-emerald-500/15 text-emerald-400', cancelled: 'bg-red-500/15 text-red-400',
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<PO>
      id={id} apiPath="/api/purchase-orders" backHref="/purchase-orders" entityLabel="purchase order"
      title={r => r.po_number}
      subtitle={r => <>{r.crm_vendors?.name ?? 'No vendor'} · {fmt(r.total, r.currency)}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status.replace('_', ' ')}</span>
      )}
      buildPayload={f => ({ status: f.status, expected_date: f.expected_date, received_date: f.received_date, notes: f.notes })}
    >
      {(record, form, update) => (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div><label className={labelCls}>Status</label>
              <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
            <div><label className={labelCls}>Expected Date</label>
              <input type="date" className={inputCls} value={form.expected_date ?? ''} onChange={e => update('expected_date', e.target.value || null as unknown as string)} /></div>
            <div><label className={labelCls}>Received Date</label>
              <input type="date" className={inputCls} value={form.received_date ?? ''} onChange={e => update('received_date', e.target.value || null as unknown as string)} /></div>
          </div>

          <div className="border border-white/5 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr><th className="text-left px-4 py-2 text-xs text-slate-400 font-semibold">Description</th>
                  <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold w-20">Qty</th>
                  <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold w-32">Rate</th>
                  <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold w-32">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {record.items.map((li, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-white">{li.description}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{li.qty}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{fmt(li.rate, record.currency)}</td>
                    <td className="px-4 py-2 text-right text-white font-medium">{fmt(li.total, record.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/3 border-t border-white/5">
                <tr><td colSpan={3} className="px-4 py-2 text-right text-white font-bold">Total</td>
                  <td className="px-4 py-2 text-right text-[#F47920] font-bold">{fmt(record.total, record.currency)}</td></tr>
              </tfoot>
            </table>
          </div>

          <div><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
        </>
      )}
    </DetailShell>
  )
}
