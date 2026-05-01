'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Activity = {
  id: string; activity_type: string; subject: string; description: string
  status: string; due_date: string | null; completed_at: string | null
  duration_mins: number | null; related_to_type: string | null; related_to_id: string | null
  created_at: string
  crm_users: { full_name: string } | null
}

const TYPE_OPTIONS = ['call', 'email', 'meeting', 'task', 'note', 'demo', 'follow_up']
const STATUS_OPTIONS = ['pending', 'completed', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  cancelled: 'bg-red-500/15 text-red-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Activity>
      id={id} apiPath="/api/activities" backHref="/activities" entityLabel="activity"
      title={r => r.subject}
      subtitle={r => <>{r.activity_type}{r.crm_users?.full_name && ` · Assigned to ${r.crm_users.full_name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      validate={f => !f.subject?.trim() ? 'Subject is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Subject *</label>
            <input className={inputCls} value={form.subject ?? ''} onChange={e => update('subject', e.target.value)} /></div>
          <div><label className={labelCls}>Type</label>
            <Select value={form.activity_type ?? ''} onValueChange={v => update('activity_type', v)}
              options={TYPE_OPTIONS.map(t => ({ value: t, label: t.replace('_', ' ') }))} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>Due Date</label>
            <input type="datetime-local" className={inputCls} value={form.due_date?.slice(0, 16) ?? ''} onChange={e => update('due_date', e.target.value || null as unknown as string)} /></div>
          <div><label className={labelCls}>Duration (mins)</label>
            <input type="number" className={inputCls} value={form.duration_mins ?? ''} onChange={e => update('duration_mins', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.description ?? ''} onChange={e => update('description', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
