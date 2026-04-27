'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { FileText, Receipt, FileSignature, TicketCheck, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import clsx from 'clsx'

type PortalData = {
  account: { id: string; name: string; website: string; industry: string; phone: string; email: string }
  invoices: { id: string; invoice_number: string; status: string; total: number; currency: string; due_date: string; issue_date: string; paid_amount: number }[]
  quotations: { id: string; quote_number: string; status: string; total: number; currency: string; valid_until: string }[]
  contracts: { id: string; contract_number: string; title: string; status: string; start_date: string; end_date: string; value: number; currency: string }[]
  tickets: { id: string; ticket_number: string; title: string; status: string; priority: string; created_at: string }[]
  vendor: { name: string; logo_url: string; website: string; email: string; phone: string }
  expiresAt: string
}

const STATUS_COLORS: Record<string, string> = {
  paid:        'text-emerald-400 bg-emerald-400/10',
  active:      'text-emerald-400 bg-emerald-400/10',
  accepted:    'text-emerald-400 bg-emerald-400/10',
  resolved:    'text-emerald-400 bg-emerald-400/10',
  closed:      'text-slate-400 bg-white/5',
  draft:       'text-slate-400 bg-white/5',
  sent:        'text-blue-400 bg-blue-400/10',
  open:        'text-yellow-400 bg-yellow-400/10',
  in_progress: 'text-blue-400 bg-blue-400/10',
  overdue:     'text-red-400 bg-red-400/10',
  expired:     'text-red-400 bg-red-400/10',
}

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[status] ?? 'text-slate-400 bg-white/5')}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'invoices' | 'quotations' | 'contracts' | 'tickets'>('invoices')

  useEffect(() => {
    fetch(`/api/portal/${token}`).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return }
      setData(d)
    })
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-[#0D1B2E] border border-red-500/20 rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-white font-bold text-lg mb-2">Access Denied</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F47920] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tabs = [
    { key: 'invoices',    label: 'Invoices',    count: data.invoices.length,    icon: <Receipt className="w-4 h-4" /> },
    { key: 'quotations',  label: 'Quotations',  count: data.quotations.length,  icon: <FileText className="w-4 h-4" /> },
    { key: 'contracts',   label: 'Contracts',   count: data.contracts.length,   icon: <FileSignature className="w-4 h-4" /> },
    { key: 'tickets',     label: 'Support',     count: data.tickets.length,     icon: <TicketCheck className="w-4 h-4" /> },
  ] as const

  return (
    <div className="min-h-screen p-4 sm:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F47920] flex items-center justify-center font-black text-white text-sm">
              IC
            </div>
            <div>
              <p className="text-white font-bold text-lg">{data.vendor?.name ?? 'Imperial CRM'}</p>
              <p className="text-slate-500 text-xs">Client Portal</p>
            </div>
          </div>
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl px-4 py-2 text-right">
            <p className="text-white font-bold text-sm">{data.account.name}</p>
            <p className="text-slate-500 text-xs">Expires {fmtDate(data.expiresAt)}</p>
          </div>
        </div>
      </header>

      {/* Summary cards */}
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Outstanding Invoices', value: data.invoices.filter(i => ['sent','overdue'].includes(i.status)).length, color: 'text-yellow-400' },
          { label: 'Active Contracts', value: data.contracts.filter(c => c.status === 'active').length, color: 'text-emerald-400' },
          { label: 'Open Tickets', value: data.tickets.filter(t => ['open','in_progress','waiting'].includes(t.status)).length, color: 'text-blue-400' },
          { label: 'Accepted Proposals', value: data.quotations.filter(q => q.status === 'accepted').length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition',
                tab === t.key
                  ? 'bg-[#F47920]/15 text-[#F47920] border border-[#F47920]/30'
                  : 'bg-[#0D1B2E] text-slate-400 border border-white/5 hover:text-white'
              )}>
              {t.icon} {t.label}
              <span className="bg-white/10 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-2xl overflow-hidden">
          {/* Invoices */}
          {tab === 'invoices' && (
            data.invoices.length === 0
              ? <p className="py-12 text-center text-slate-600 text-sm">No invoices.</p>
              : <table className="w-full">
                  <thead><tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide hidden sm:table-cell">Issued</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Due</th>
                    <th className="px-5 py-3 text-right text-xs text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Status</th>
                  </tr></thead>
                  <tbody>
                    {data.invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3.5 text-white text-sm font-medium">{inv.invoice_number}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-sm hidden sm:table-cell">{fmtDate(inv.issue_date)}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-sm">{fmtDate(inv.due_date)}</td>
                        <td className="px-5 py-3.5 text-right text-[#F47920] font-bold text-sm">{fmt(inv.total, inv.currency)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {/* Quotations */}
          {tab === 'quotations' && (
            data.quotations.length === 0
              ? <p className="py-12 text-center text-slate-600 text-sm">No quotations.</p>
              : <table className="w-full">
                  <thead><tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Quote #</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Valid Until</th>
                    <th className="px-5 py-3 text-right text-xs text-slate-500 uppercase tracking-wide">Value</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Status</th>
                  </tr></thead>
                  <tbody>
                    {data.quotations.map(q => (
                      <tr key={q.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3.5 text-white text-sm font-medium">{q.quote_number}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-sm">{fmtDate(q.valid_until)}</td>
                        <td className="px-5 py-3.5 text-right text-[#F47920] font-bold text-sm">{fmt(q.total, q.currency)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={q.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {/* Contracts */}
          {tab === 'contracts' && (
            data.contracts.length === 0
              ? <p className="py-12 text-center text-slate-600 text-sm">No contracts.</p>
              : <table className="w-full">
                  <thead><tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Contract</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide hidden sm:table-cell">Period</th>
                    <th className="px-5 py-3 text-right text-xs text-slate-500 uppercase tracking-wide">Value</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Status</th>
                  </tr></thead>
                  <tbody>
                    {data.contracts.map(c => (
                      <tr key={c.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="text-white text-sm font-medium">{c.title}</p>
                          <p className="text-slate-500 text-xs">{c.contract_number}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <p className="text-slate-400 text-xs">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right text-[#F47920] font-bold text-sm">
                          {c.value ? fmt(c.value, c.currency) : '—'}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {/* Tickets */}
          {tab === 'tickets' && (
            data.tickets.length === 0
              ? <p className="py-12 text-center text-slate-600 text-sm">No support tickets.</p>
              : <table className="w-full">
                  <thead><tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Ticket</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Priority</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wide hidden sm:table-cell">Opened</th>
                  </tr></thead>
                  <tbody>
                    {data.tickets.map(t => (
                      <tr key={t.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="text-white text-sm font-medium">{t.title}</p>
                          <p className="text-slate-500 text-xs">{t.ticket_number}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                            t.priority === 'critical' ? 'text-red-400 bg-red-400/10' :
                            t.priority === 'high'     ? 'text-orange-400 bg-orange-400/10' :
                            t.priority === 'medium'   ? 'text-yellow-400 bg-yellow-400/10' :
                            'text-slate-400 bg-white/5'
                          )}>{t.priority}</span>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
        </div>
      </div>

      <p className="text-center text-slate-700 text-xs mt-8">
        Powered by Imperial CRM · Imperial Tech Innovations Pvt Ltd
      </p>
    </div>
  )
}
