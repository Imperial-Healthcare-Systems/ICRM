'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type FieldVisit = {
  id: string; visit_number: string; title: string; status: string
  scheduled_at: string | null; completed_at: string | null
  location: string; notes: string; outcome: string
  account_id: string | null; contact_id: string | null
  crm_accounts: { name: string } | null
  crm_users: { full_name: string } | null
  created_at: string
}

const STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  cancelled: 'bg-red-500/15 text-red-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<FieldVisit>
      id={id} apiPath="/api/field-visits" backHref="/field-visits" entityLabel="field visit"
      title={r => r.title}
      subtitle={r => <>{r.visit_number}{r.crm_accounts?.name && ` · ${r.crm_accounts.name}`}{r.crm_users?.full_name && ` · ${r.crm_users.full_name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status.replace('_', ' ')}</span>
      )}
      validate={f => !f.title?.trim() ? 'Title is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} /></div>
          <div><label className={labelCls}>Scheduled At</label>
            <input type="datetime-local" className={inputCls} value={form.scheduled_at?.slice(0, 16) ?? ''} onChange={e => update('scheduled_at', e.target.value || null as unknown as string)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Location</label>
            <input className={inputCls} value={form.location ?? ''} onChange={e => update('location', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Outcome</label>
            <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.outcome ?? ''} onChange={e => update('outcome', e.target.value)} placeholder="What was the result of this visit?" /></div>
        </div>
      )}
    </DetailShell>
  )
}
