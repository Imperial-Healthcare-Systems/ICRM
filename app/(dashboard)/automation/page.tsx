'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Zap, Plus, Play, Pause, Trash2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
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
    <div className="p-6">
      <PageHeader
        title="Automation"
        subtitle={`${rules.length} rules · ${active} active`}
        actions={
          <Link href="/automation/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Rule
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#0D1B2E] border border-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl">
          <EmptyState icon={<Zap className="w-7 h-7" />} title="No automation rules yet"
            description="Automate repetitive tasks by setting trigger-based rules." actionLabel="New Rule" actionHref="/automation/new" />
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className={clsx('bg-[#0D1B2E] border rounded-xl p-5 flex items-center gap-4 transition',
              rule.is_active ? 'border-white/5' : 'border-white/3 opacity-60')}>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                rule.is_active ? 'bg-[#F47920]/20' : 'bg-white/5')}>
                <Zap className={clsx('w-5 h-5', rule.is_active ? 'text-[#F47920]' : 'text-slate-500')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-medium">{rule.name}</p>
                  {!rule.is_active && <span className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded font-semibold">PAUSED</span>}
                </div>
                <p className="text-slate-500 text-xs">
                  When <span className="text-blue-400">{EVENT_LABELS[rule.trigger_event] ?? rule.trigger_event}</span>
                  {' → '}
                  <span className="text-emerald-400">{ACTION_LABELS[rule.action_type] ?? rule.action_type}</span>
                </p>
                {rule.description && <p className="text-slate-600 text-xs mt-0.5">{rule.description}</p>}
              </div>

              <div className="text-right shrink-0 hidden md:block">
                <p className="text-[#F47920] font-bold text-sm">{rule.run_count.toLocaleString()}</p>
                <p className="text-slate-600 text-xs">runs</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
