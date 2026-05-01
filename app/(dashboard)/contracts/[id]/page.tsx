'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Contract = {
  id: string; contract_number: string; title: string; contract_type: string
  status: string; start_date: string | null; end_date: string | null
  value: number | null; currency: string; renewal_notice_days: number
  notes: string; account_id: string | null
  crm_accounts: { name: string } | null
  created_at: string
}

const STATUS_OPTIONS = ['draft', 'active', 'expired', 'terminated', 'renewed']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400', active: 'bg-emerald-500/15 text-emerald-400',
  expired: 'bg-red-500/15 text-red-400', terminated: 'bg-orange-500/15 text-orange-400',
  renewed: 'bg-blue-500/15 text-blue-400',
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0)

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Contract>
      id={id} apiPath="/api/contracts" backHref="/contracts" entityLabel="contract"
      title={r => r.title}
      subtitle={r => <>{r.contract_number}{r.crm_accounts?.name && ` · ${r.crm_accounts.name}`}{r.value && ` · ${fmt(r.value)}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      validate={f => !f.title?.trim() ? 'Title is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>Type</label>
            <input className={inputCls} value={form.contract_type ?? ''} onChange={e => update('contract_type', e.target.value)} /></div>
          <div><label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={form.start_date ?? ''} onChange={e => update('start_date', e.target.value || null as unknown as string)} /></div>
          <div><label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={form.end_date ?? ''} onChange={e => update('end_date', e.target.value || null as unknown as string)} /></div>
          <div><label className={labelCls}>Contract Value (₹)</label>
            <input type="number" className={inputCls} value={form.value ?? ''} onChange={e => update('value', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
          <div><label className={labelCls}>Renewal Notice (days)</label>
            <input type="number" className={inputCls} value={form.renewal_notice_days ?? 30} onChange={e => update('renewal_notice_days', Number(e.target.value))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
