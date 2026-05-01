'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Rule = {
  id: string; name: string; description: string
  trigger_event: string; action_type: string
  trigger_conditions: Record<string, unknown>; action_config: Record<string, unknown>
  is_active: boolean; run_count: number; last_run_at: string | null
  created_at: string
}

const TRIGGER_EVENTS = [
  'deal.created', 'deal.won', 'deal.lost', 'deal.stage_changed',
  'contact.created', 'lead.created', 'lead.qualified',
  'ticket.created', 'ticket.resolved', 'invoice.overdue', 'invoice.paid', 'contract.expiring',
]
const ACTION_TYPES = [
  'send_email', 'create_activity', 'assign_user', 'award_loyalty_points',
  'add_note', 'update_field', 'create_ticket', 'send_webhook',
]

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Rule>
      id={id} apiPath="/api/automation" backHref="/automation" entityLabel="rule"
      title={r => r.name}
      subtitle={r => <>{r.trigger_event} → {r.action_type} · Run {r.run_count} times</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', r.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400')}>
          {r.is_active ? 'Active' : 'Paused'}
        </span>
      )}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
      buildPayload={f => ({
        name: f.name, description: f.description,
        trigger_event: f.trigger_event, action_type: f.action_type,
        is_active: f.is_active,
        action_config: f.action_config,
        trigger_conditions: f.trigger_conditions,
      })}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description</label>
            <input className={inputCls} value={form.description ?? ''} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Trigger Event</label>
            <Select value={form.trigger_event ?? ''} onValueChange={v => update('trigger_event', v)}
              options={TRIGGER_EVENTS.map(t => ({ value: t, label: t }))} /></div>
          <div><label className={labelCls}>Action Type</label>
            <Select value={form.action_type ?? ''} onValueChange={v => update('action_type', v)}
              options={ACTION_TYPES.map(t => ({ value: t, label: t.replace('_', ' ') }))} /></div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920] focus:ring-[#F47920]/40"
                checked={form.is_active ?? false} onChange={e => update('is_active', e.target.checked)} />
              <span className="text-white text-sm font-medium">Rule active</span>
            </label>
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Action Config (JSON)</label>
            <textarea className={clsx(inputCls, 'min-h-[120px] font-mono text-xs resize-y')}
              value={JSON.stringify(form.action_config ?? {}, null, 2)}
              onChange={e => { try { update('action_config', JSON.parse(e.target.value)) } catch { /* leave as-is */ } }} /></div>
        </div>
      )}
    </DetailShell>
  )
}
