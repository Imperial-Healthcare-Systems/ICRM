'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { ArrowRightCircle } from 'lucide-react'

import Select from '@/components/ui/Select'
type LineItem = { description: string; qty: number; rate: number; total: number }
type Quote = {
  id: string; quote_number: string; status: string; valid_until: string | null
  items: LineItem[]; subtotal: number; discount_pct: number; tax_pct: number
  total: number; currency: string; notes: string; terms: string
  account_id: string | null; contact_id: string | null
  crm_accounts: { name: string } | null
  created_at: string
}

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'rejected', 'expired']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400', sent: 'bg-blue-500/15 text-blue-400',
  accepted: 'bg-emerald-500/15 text-emerald-400', rejected: 'bg-red-500/15 text-red-400',
  expired: 'bg-yellow-500/15 text-yellow-400',
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)

async function convertToInvoice(id: string) {
  if (!confirm('Convert this quotation to an invoice?')) return
  const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) { toast.error(data.error ?? 'Convert failed.'); return }
  toast.success(`Invoice ${data.data.invoice_number} created.`)
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Quote>
      id={id} apiPath="/api/quotations" backHref="/quotations" entityLabel="quotation"
      title={r => r.quote_number}
      subtitle={r => <>{r.crm_accounts?.name ?? '—'} · {fmt(r.total, r.currency)}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      buildPayload={f => ({ status: f.status, valid_until: f.valid_until, notes: f.notes, terms: f.terms })}
    >
      {(record, form, update) => (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div><label className={labelCls}>Status</label>
              <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
            <div><label className={labelCls}>Valid Until</label>
              <input type="date" className={inputCls} value={form.valid_until ?? ''} onChange={e => update('valid_until', e.target.value || null as unknown as string)} /></div>
          </div>

          {/* Line items (read-only) */}
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
                <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-400 text-xs">Subtotal</td>
                  <td className="px-4 py-2 text-right text-slate-300">{fmt(record.subtotal, record.currency)}</td></tr>
                <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-400 text-xs">Tax ({record.tax_pct ?? 0}%)</td>
                  <td className="px-4 py-2 text-right text-slate-300">{fmt(((record.subtotal * (record.tax_pct ?? 0)) / 100), record.currency)}</td></tr>
                <tr><td colSpan={3} className="px-4 py-2 text-right text-white font-bold">Total</td>
                  <td className="px-4 py-2 text-right text-[#F47920] font-bold">{fmt(record.total, record.currency)}</td></tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Notes</label>
              <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
            <div><label className={labelCls}>Terms</label>
              <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.terms ?? ''} onChange={e => update('terms', e.target.value)} /></div>
          </div>

          {['draft', 'sent', 'accepted'].includes(record.status) && (
            <button onClick={() => convertToInvoice(record.id)}
              className="mt-4 flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold px-4 py-2 rounded-lg text-sm transition">
              <ArrowRightCircle className="w-4 h-4" /> Convert to Invoice
            </button>
          )}
        </>
      )}
    </DetailShell>
  )
}
