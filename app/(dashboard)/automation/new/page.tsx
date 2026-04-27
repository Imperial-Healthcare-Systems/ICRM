'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2, Zap, ArrowRight } from 'lucide-react'

const TRIGGER_EVENTS = [
  { value: 'deal.created',       label: 'Deal Created',        group: 'Deals' },
  { value: 'deal.won',           label: 'Deal Won',            group: 'Deals' },
  { value: 'deal.lost',          label: 'Deal Lost',           group: 'Deals' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed',  group: 'Deals' },
  { value: 'contact.created',    label: 'Contact Created',     group: 'CRM' },
  { value: 'lead.created',       label: 'Lead Created',        group: 'CRM' },
  { value: 'lead.qualified',     label: 'Lead Qualified',      group: 'CRM' },
  { value: 'ticket.created',     label: 'Ticket Created',      group: 'Support' },
  { value: 'ticket.resolved',    label: 'Ticket Resolved',     group: 'Support' },
  { value: 'invoice.overdue',    label: 'Invoice Overdue',     group: 'Finance' },
  { value: 'invoice.paid',       label: 'Invoice Paid',        group: 'Finance' },
  { value: 'contract.expiring',  label: 'Contract Expiring',   group: 'Finance' },
]

const ACTION_TYPES = [
  { value: 'send_email',           label: 'Send Email',           desc: 'Send an automated email' },
  { value: 'create_activity',      label: 'Create Activity',      desc: 'Log a follow-up task or call' },
  { value: 'assign_user',          label: 'Assign User',          desc: 'Auto-assign to a team member' },
  { value: 'award_loyalty_points', label: 'Award Loyalty Points', desc: 'Add points to a contact' },
  { value: 'add_note',             label: 'Add Note',             desc: 'Attach a note to the record' },
  { value: 'create_ticket',        label: 'Create Ticket',        desc: 'Open a support ticket' },
  { value: 'send_webhook',         label: 'Send Webhook',         desc: 'POST data to an external URL' },
]

export default function NewAutomationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({
    name: '', description: '',
    trigger_event: '', action_type: '',
    action_config: {} as Record<string, string>,
  })

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  async function handleSubmit() {
    if (!form.name.trim() || !form.trigger_event || !form.action_type) {
      toast.error('Please complete all required fields.'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          trigger_event: form.trigger_event,
          action_type: form.action_type,
          action_config: form.action_config,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Automation rule created!')
      router.push('/automation')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const selectedTrigger = TRIGGER_EVENTS.find(t => t.value === form.trigger_event)
  const selectedAction = ACTION_TYPES.find(a => a.value === form.action_type)

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Automation Rule" backHref="/automation" />

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${step >= s ? 'bg-[#F47920] text-white' : 'bg-white/5 text-slate-500'}`}>{s}</div>
            {s < 3 && <div className={`w-8 h-0.5 rounded ${step > s ? 'bg-[#F47920]' : 'bg-white/10'}`} />}
          </div>
        ))}
        <span className="text-slate-500 text-xs ml-1">{step === 1 ? 'Choose Trigger' : step === 2 ? 'Choose Action' : 'Name & Save'}</span>
      </div>

      {/* Step 1: Trigger */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm font-medium mb-4">When this happens…</p>
          {Object.entries(
            TRIGGER_EVENTS.reduce((g, t) => { g[t.group] = [...(g[t.group] ?? []), t]; return g }, {} as Record<string, typeof TRIGGER_EVENTS>)
          ).map(([group, events]) => (
            <div key={group}>
              <p className="text-slate-600 text-xs uppercase tracking-wide mb-2">{group}</p>
              <div className="grid grid-cols-2 gap-2">
                {events.map(ev => (
                  <button key={ev.value} onClick={() => { setForm(f => ({ ...f, trigger_event: ev.value })); setStep(2) }}
                    className={`text-left p-3 rounded-xl border text-sm font-medium transition ${form.trigger_event === ev.value ? 'border-[#F47920]/40 bg-[#F47920]/10 text-[#F47920]' : 'border-white/5 bg-[#0D1B2E] text-slate-300 hover:border-white/10 hover:bg-white/5'}`}>
                    {ev.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Action */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm font-medium mb-4">
            When <span className="text-blue-400">{selectedTrigger?.label}</span> → do this…
          </p>
          <div className="space-y-2">
            {ACTION_TYPES.map(action => (
              <button key={action.value}
                onClick={() => { setForm(f => ({ ...f, action_type: action.value })); setStep(3) }}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-3 transition ${form.action_type === action.value ? 'border-[#F47920]/40 bg-[#F47920]/10' : 'border-white/5 bg-[#0D1B2E] hover:border-white/10 hover:bg-white/5'}`}>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-[#F47920]" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{action.label}</p>
                  <p className="text-slate-500 text-xs">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-300 text-sm transition">← Back</button>
        </div>
      )}

      {/* Step 3: Name and action config */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <span className="text-blue-400 text-sm font-medium">{selectedTrigger?.label}</span>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span className="text-emerald-400 text-sm font-medium">{selectedAction?.label}</span>
          </div>

          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
            <div>
              <label className={labelCls}>Rule Name *</label>
              <input className={inputCls} placeholder="e.g. Welcome email on new contact" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={2} className={inputCls} placeholder="Briefly describe what this rule does…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {form.action_type === 'send_email' && (
              <>
                <div>
                  <label className={labelCls}>Email Subject</label>
                  <input className={inputCls} placeholder="Subject line" value={form.action_config.subject ?? ''}
                    onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, subject: e.target.value } }))} />
                </div>
                <div>
                  <label className={labelCls}>Email Body</label>
                  <textarea rows={4} className={inputCls} placeholder="Email content. Use {{contact_name}}, {{deal_title}} as variables."
                    value={form.action_config.body ?? ''}
                    onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, body: e.target.value } }))} />
                </div>
              </>
            )}
            {form.action_type === 'create_activity' && (
              <div>
                <label className={labelCls}>Activity Title</label>
                <input className={inputCls} placeholder="Follow up call" value={form.action_config.title ?? ''}
                  onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, title: e.target.value } }))} />
              </div>
            )}
            {form.action_type === 'award_loyalty_points' && (
              <div>
                <label className={labelCls}>Points to Award</label>
                <input type="number" className={inputCls} placeholder="100" value={form.action_config.points ?? ''}
                  onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, points: e.target.value } }))} />
              </div>
            )}
            {form.action_type === 'send_webhook' && (
              <div>
                <label className={labelCls}>Webhook URL</label>
                <input type="url" className={inputCls} placeholder="https://your-server.com/webhook"
                  value={form.action_config.url ?? ''}
                  onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, url: e.target.value } }))} />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Saving…' : 'Create Rule'}
            </button>
            <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">← Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
