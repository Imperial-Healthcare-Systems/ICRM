'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Proposal = {
  id: string; proposal_number: string; title: string; status: string
  valid_until: string | null; cover_note: string
  sections: Array<{ title?: string; body?: string }>
  account_id: string | null
  crm_accounts: { name: string } | null
  created_at: string
}

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'rejected', 'expired']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400', sent: 'bg-blue-500/15 text-blue-400',
  accepted: 'bg-emerald-500/15 text-emerald-400', rejected: 'bg-red-500/15 text-red-400',
  expired: 'bg-yellow-500/15 text-yellow-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Proposal>
      id={id} apiPath="/api/proposals" backHref="/proposals" entityLabel="proposal"
      title={r => r.title}
      subtitle={r => <>{r.proposal_number}{r.crm_accounts?.name && ` · ${r.crm_accounts.name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      validate={f => !f.title?.trim() ? 'Title is required.' : null}
      buildPayload={f => ({ title: f.title, status: f.status, valid_until: f.valid_until, cover_note: f.cover_note })}
    >
      {(record, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>Valid Until</label>
            <input type="date" className={inputCls} value={form.valid_until ?? ''} onChange={e => update('valid_until', e.target.value || null as unknown as string)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Cover Note</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.cover_note ?? ''} onChange={e => update('cover_note', e.target.value)} /></div>
          {record.sections?.length > 0 && (
            <div className="sm:col-span-2 space-y-3 mt-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold">Sections</p>
              {record.sections.map((s, i) => (
                <div key={i} className="bg-white/3 border border-white/5 rounded-lg p-4">
                  <p className="text-white font-medium text-sm mb-1">{s.title ?? `Section ${i + 1}`}</p>
                  <p className="text-slate-400 text-xs whitespace-pre-wrap">{s.body ?? ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DetailShell>
  )
}
