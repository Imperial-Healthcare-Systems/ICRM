'use client'
import { use, useEffect, useState } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Deal = {
  id: string; title: string; deal_value: number; currency: string
  deal_status: string; probability: number; expected_close: string | null
  actual_close: string | null; lost_reason: string; notes: string
  account_id: string | null; contact_id: string | null; stage_id: string | null
  created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_pipeline_stages: { name: string } | null
  crm_users: { full_name: string } | null
}

const STATUS_OPTIONS = ['open', 'won', 'lost', 'on_hold']
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/15 text-blue-400', won: 'bg-emerald-500/15 text-emerald-400',
  lost: 'bg-red-500/15 text-red-400', on_hold: 'bg-yellow-500/15 text-yellow-400',
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0)

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { fetch('/api/pipeline-stages').then(r => r.json()).then(d => setStages(d.data ?? [])) }, [])

  return (
    <DetailShell<Deal>
      id={id} apiPath="/api/deals" backHref="/deals" entityLabel="deal"
      title={r => r.title}
      subtitle={r => <>{fmt(r.deal_value)} · {r.crm_pipeline_stages?.name ?? '—'}{r.crm_accounts?.name && ` · ${r.crm_accounts.name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.deal_status])}>{r.deal_status}</span>
      )}
      validate={f => !f.title?.trim() ? 'Title is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>
          <div><label className={labelCls}>Deal Value (₹)</label>
            <input type="number" className={inputCls} value={form.deal_value ?? 0} onChange={e => update('deal_value', Number(e.target.value))} /></div>
          <div><label className={labelCls}>Stage</label>
            <Select value={form.stage_id ?? ''} onValueChange={v => update('stage_id', v || null as unknown as string)} placeholder="No stage" allowClear clearLabel="No stage"
              options={stages.map(s => ({ value: s.id, label: s.name }))} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.deal_status ?? ''} onValueChange={v => update('deal_status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>Probability (%)</label>
            <input type="number" min="0" max="100" className={inputCls} value={form.probability ?? 0} onChange={e => update('probability', Number(e.target.value))} /></div>
          <div><label className={labelCls}>Expected Close</label>
            <input type="date" className={inputCls} value={form.expected_close ?? ''} onChange={e => update('expected_close', e.target.value || null as unknown as string)} /></div>
          <div><label className={labelCls}>Actual Close</label>
            <input type="date" className={inputCls} value={form.actual_close ?? ''} onChange={e => update('actual_close', e.target.value || null as unknown as string)} /></div>
          {form.deal_status === 'lost' && (
            <div className="sm:col-span-2"><label className={labelCls}>Lost Reason</label>
              <input className={inputCls} value={form.lost_reason ?? ''} onChange={e => update('lost_reason', e.target.value)} /></div>
          )}
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
