'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Campaign = {
  id: string; name: string; type: string; status: string
  subject: string; body: string; from_name: string
  scheduled_at: string | null; sent_at: string | null
  recipient_count: number; open_count: number; click_count: number
  bounce_count: number; unsubscribe_count: number; created_at: string
}

const TYPE_OPTIONS = ['email', 'whatsapp', 'sms']
const STATUS_OPTIONS = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  sending: 'bg-yellow-500/15 text-yellow-400',
  sent: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-orange-500/15 text-orange-400',
  cancelled: 'bg-red-500/15 text-red-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Campaign>
      id={id} apiPath="/api/campaigns" backHref="/campaigns" entityLabel="campaign"
      title={r => r.name}
      subtitle={r => <>{r.type} · {r.recipient_count} recipients · {r.open_count} opens · {r.click_count} clicks</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>Type</label>
            <Select value={form.type ?? ''} onValueChange={v => update('type', v)}
              options={TYPE_OPTIONS.map(t => ({ value: t, label: t }))} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>From Name</label>
            <input className={inputCls} value={form.from_name ?? ''} onChange={e => update('from_name', e.target.value)} /></div>
          <div><label className={labelCls}>Scheduled At</label>
            <input type="datetime-local" className={inputCls} value={form.scheduled_at?.slice(0, 16) ?? ''} onChange={e => update('scheduled_at', e.target.value || null as unknown as string)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Subject</label>
            <input className={inputCls} value={form.subject ?? ''} onChange={e => update('subject', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Body</label>
            <textarea className={clsx(inputCls, 'min-h-[180px] resize-y')} value={form.body ?? ''} onChange={e => update('body', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
