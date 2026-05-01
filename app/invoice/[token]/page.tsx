'use client'

import { use, useEffect, useState } from 'react'
import { Download, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react'
import clsx from 'clsx'

type LineItem = { description: string; qty: number; rate: number; total: number }
type Payment = { id: string; amount: number; payment_method: string; reference: string | null; paid_at: string }
type InvoiceData = {
  invoice_number: string; status: string; issue_date: string; due_date: string | null; paid_date: string | null
  items: LineItem[]; subtotal: number; tax_pct: number; total: number; paid_amount: number; currency: string
  notes: string | null; terms: string | null
  account: { name: string; email: string | null; phone: string | null } | null
  organisation: { name: string; gstin: string | null; phone: string | null; website: string | null; address: string | null; logo_url: string | null } | null
  payments: Payment[]
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-500 text-white',
  partially_paid: 'bg-yellow-500 text-white',
  overdue: 'bg-red-500 text-white',
  sent: 'bg-blue-500 text-white',
  draft: 'bg-slate-500 text-white',
  cancelled: 'bg-slate-400 text-white',
  void: 'bg-slate-400 text-white',
}

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<InvoiceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/invoice/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d.data) })
      .catch(() => setError('Failed to load invoice.'))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-lg mb-2">Invoice not available</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-[#F47920] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const total = data.total
  const paid = data.paid_amount
  const outstanding = Math.max(0, total - paid)
  const isFullyPaid = outstanding < 0.01

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <p className="text-slate-500 text-xs">Invoice from <span className="font-semibold text-slate-700">{data.organisation?.name}</span></p>
          <a href={`/api/public/invoice/${token}/pdf`} download={`${data.invoice_number}.pdf`}
            className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm">
            <Download className="w-4 h-4" /> Download PDF
          </a>
        </div>

        {/* Invoice card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
          {/* Header band */}
          <div className="bg-[#0D1B2E] px-8 pt-8 pb-6 relative">
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#F47920]" />
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-white text-xl font-bold">{data.organisation?.name}</h1>
                <p className="text-slate-300 text-xs mt-1">
                  {[data.organisation?.address, data.organisation?.phone, data.organisation?.website].filter(Boolean).join(' · ')}
                </p>
                {data.organisation?.gstin && <p className="text-slate-400 text-[11px] mt-0.5">GSTIN: {data.organisation.gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-white text-2xl font-bold tracking-tight">INVOICE</p>
                <p className="text-slate-300 text-sm mt-0.5">#{data.invoice_number}</p>
                <span className={clsx('inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide', STATUS_STYLES[data.status] ?? 'bg-slate-500 text-white')}>
                  {data.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Bill-to + dates */}
          <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Bill To</p>
              <p className="text-slate-900 font-semibold">{data.account?.name ?? '—'}</p>
              {data.account?.email && <p className="text-slate-500 text-xs">{data.account.email}</p>}
              {data.account?.phone && <p className="text-slate-500 text-xs">{data.account.phone}</p>}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Issued</p>
              <p className="text-slate-900 text-sm">{fmtDate(data.issue_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Due</p>
              <p className={clsx('text-sm font-medium', data.status === 'overdue' ? 'text-red-600' : 'text-slate-900')}>{fmtDate(data.due_date)}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-[10px] text-slate-400 font-semibold uppercase tracking-wider pb-2">Description</th>
                  <th className="text-right text-[10px] text-slate-400 font-semibold uppercase tracking-wider pb-2 w-16">Qty</th>
                  <th className="text-right text-[10px] text-slate-400 font-semibold uppercase tracking-wider pb-2 w-28">Rate</th>
                  <th className="text-right text-[10px] text-slate-400 font-semibold uppercase tracking-wider pb-2 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((li, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-900">{li.description}</td>
                    <td className="py-3 text-right text-slate-600">{li.qty}</td>
                    <td className="py-3 text-right text-slate-600 tabular-nums">{fmt(li.rate, data.currency)}</td>
                    <td className="py-3 text-right text-slate-900 font-medium tabular-nums">{fmt(li.total, data.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-6">
            <div className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-900 tabular-nums">{fmt(data.subtotal, data.currency)}</span></div>
              {data.tax_pct > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Tax ({data.tax_pct}%)</span><span className="text-slate-900 tabular-nums">{fmt(total - data.subtotal, data.currency)}</span></div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span className="text-slate-900">Total</span><span className="text-slate-900 tabular-nums">{fmt(total, data.currency)}</span></div>
              {paid > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="tabular-nums">- {fmt(paid, data.currency)}</span></div>
              )}
              <div className={clsx('flex justify-between mt-2 px-3 py-2 rounded-lg', isFullyPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F47920]/10 text-[#F47920]')}>
                <span className="font-bold uppercase text-xs tracking-wide flex items-center gap-1.5">
                  {isFullyPaid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Paid in full</> : 'Amount Due'}
                </span>
                <span className="font-bold tabular-nums">{isFullyPaid ? fmtDate(data.paid_date) : fmt(outstanding, data.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {data.payments.length > 0 && (
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Payment History</p>
              <div className="space-y-1.5">
                {data.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3 text-emerald-500" />
                      {fmtDate(p.paid_at)} · <span className="capitalize">{p.payment_method.replace('_', ' ')}</span>
                      {p.reference && <span className="text-slate-400"> · {p.reference}</span>}
                    </span>
                    <span className="text-slate-900 font-medium tabular-nums">{fmt(p.amount, data.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes & terms */}
          {(data.notes || data.terms) && (
            <div className="px-8 py-5 border-t border-slate-100 space-y-3">
              {data.notes && (
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
              {data.terms && (
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Terms & Conditions</p>
                  <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{data.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-100 text-center">
            <p className="text-[10px] text-slate-500">Powered by Imperial CRM</p>
          </div>
        </div>
      </div>
    </div>
  )
}
