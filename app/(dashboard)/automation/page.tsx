'use client'

import { useEffect, useState, useCallback } from 'react'
import { Zap, Plus, Play, Pause, Trash2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Rule = {
  id: string; name: string; description: string
  trigger_event: string; action_type: string
  is_active: boolean; run_count: number; last_run_at: string
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  'deal.created': 'Deal Created', 'deal.won': 'Deal Won', 'deal.lost': 'Deal Lost',
  'deal.stage_changed': 'Deal Stage Changed', 'contact.created': 'Contact Created',
  'lead.created': 'Lead Created', 'lead.qualified': 'Lead Qualified',
  'ticket.created': 'Ticket Created', 'ticket.resolved': 'Ticket Resolved',
  'invoice.overdue': 'Invoice Overdue', 'invoice.paid': 'Invoice Paid',
  'contract.expiring': 'Contract Expiring',
}

const ACTION_LABELS: Record<string, string> = {
  'send_email': 'Send Email', 'create_activity': 'Create Activity',
  'assign_user': 'Assign User', 'award_loyalty_points': 'Award Loyalty Points',
  'add_note': 'Add Note', 'update_field': 'Update Field',
  'create_ticket': 'Create Ticket', 'send_webhook': 'Send Webhook',
}

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/automation')
    const data = await res.json()
    setRules(data.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  async function toggleRule(id: string, isActive: boolean) {
    const res = await fetch(`/api/automation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (res.ok) { toast.success(!isActive ? 'Rule activated.' : 'Rule paused.'); fetchRules() }
    else toast.error('Failed to update rule.')
  }

  async function deleteRule(id: string, name: string) {
    if (!confirm(`Delete rule "${name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/automation/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Rule deleted.'); fetchRules() }
    else toast.error('Failed to delete rule.')
  }

  const active = rules.filter(r => r.is_active).length

  return (
    <div className="p-6 mx-auto max-w-5xl">
      <PageHeader
        kicker="Workflow"
        title="Automation"
        subtitle={`${rules.length} rules · ${active} active`}
        actions={<Button href="/automation/new" icon={<Plus className="w-4 h-4" />}>New Rule</Button>}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<Zap className="w-7 h-7" />} title="No automation rules yet"
            description="Automate repetitive tasks by setting trigger-based rules."
            actionLabel="New Rule" actionHref="/automation/new" />
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <div key={rule.id}
                 className={clsx('surface-premium hover-lift p-5 flex items-center gap-4 transition anim-rise',
                   !rule.is_active && 'opacity-60')}
                 style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                rule.is_active ? 'bg-[#F47920]/15' : 'bg-white/[0.04]')}>
                <Zap className={clsx('w-5 h-5', rule.is_active ? 'text-[#F47920]' : 'text-slate-500')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-medium">{rule.name}</p>
                  {!rule.is_active && <StatusPill tone="slate" size="xs">Paused</StatusPill>}
                </div>
                <p className="text-slate-500 text-xs">
                  When <span className="text-blue-400">{EVENT_LABELS[rule.trigger_event] ?? rule.trigger_event}</span>
                  {' → '}
                  <span className="text-emerald-400">{ACTION_LABELS[rule.action_type] ?? rule.action_type}</span>
                </p>
                {rule.description && <p className="text-slate-600 text-xs mt-0.5">{rule.description}</p>}
              </div>

              <div className="text-right shrink-0 hidden md:block">
                <p className="text-[#F47920] font-bold text-sm tabular-nums">{rule.run_count.toLocaleString()}</p>
                <p className="text-slate-600 text-[10px] uppercase tracking-wider font-bold">runs</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleRule(rule.id, rule.is_active)}
                  className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition',
                    rule.is_active ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')}
                  title={rule.is_active ? 'Pause rule' : 'Activate rule'}
                >
                  {rule.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => deleteRule(rule.id, rule.name)}
                  className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition"
                  title="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
