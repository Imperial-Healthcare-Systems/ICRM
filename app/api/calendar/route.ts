import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit } from '@/lib/rate-limit'

type CalEvent = {
  id: string
  source: 'activity' | 'field_visit' | 'task' | 'invoice' | 'contract' | 'deal' | 'project'
  title: string
  date: string         // ISO date or datetime
  end_date?: string | null
  status?: string
  href: string
  badge?: string
  color?: string
}

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregates all dated records (activities, visits, tasks, invoice due dates,
 * contract end dates, deal close dates, project milestones) into a single feed.
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]
  const to = url.searchParams.get('to') ?? new Date(Date.now() + 60 * 86_400_000).toISOString().split('T')[0]

  const events: CalEvent[] = []

  // Activities (due_date)
  const { data: activities } = await supabaseAdmin
    .from('crm_activities')
    .select('id, subject, activity_type, status, due_date')
    .eq('org_id', orgId)
    .not('due_date', 'is', null)
    .gte('due_date', from)
    .lte('due_date', to)
    .limit(200)
  for (const a of activities ?? []) {
    events.push({
      id: a.id, source: 'activity', title: a.subject, date: a.due_date,
      status: a.status, badge: a.activity_type, href: `/activities/${a.id}`,
      color: a.status === 'completed' ? 'emerald' : 'blue',
    })
  }

  // Field visits (scheduled_at)
  const { data: visits } = await supabaseAdmin
    .from('crm_field_visits')
    .select('id, title, status, scheduled_at')
    .eq('org_id', orgId)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', from + 'T00:00:00Z')
    .lte('scheduled_at', to + 'T23:59:59Z')
    .limit(200)
  for (const v of visits ?? []) {
    events.push({
      id: v.id, source: 'field_visit', title: v.title, date: v.scheduled_at,
      status: v.status, badge: 'visit', href: `/field-visits/${v.id}`, color: 'purple',
    })
  }

  // Tasks (due_date)
  const { data: tasks } = await supabaseAdmin
    .from('crm_tasks')
    .select('id, title, status, due_date, priority')
    .eq('org_id', orgId)
    .not('due_date', 'is', null)
    .gte('due_date', from)
    .lte('due_date', to)
    .limit(200)
  for (const t of tasks ?? []) {
    events.push({
      id: t.id, source: 'task', title: t.title, date: t.due_date,
      status: t.status, badge: t.priority, href: `/tasks/${t.id}`,
      color: t.status === 'done' ? 'emerald' : t.priority === 'critical' ? 'red' : 'orange',
    })
  }

  // Invoice due dates
  const { data: invoices } = await supabaseAdmin
    .from('crm_invoices')
    .select('id, invoice_number, status, due_date, total')
    .eq('org_id', orgId)
    .not('due_date', 'is', null)
    .gte('due_date', from)
    .lte('due_date', to)
    .in('status', ['sent', 'overdue', 'partially_paid'])
    .limit(200)
  for (const i of invoices ?? []) {
    events.push({
      id: i.id, source: 'invoice', title: `${i.invoice_number} due`, date: i.due_date,
      status: i.status, badge: '₹', href: `/invoices/${i.id}`,
      color: i.status === 'overdue' ? 'red' : 'yellow',
    })
  }

  // Contract end dates
  const { data: contracts } = await supabaseAdmin
    .from('crm_contracts')
    .select('id, contract_number, title, status, end_date')
    .eq('org_id', orgId)
    .not('end_date', 'is', null)
    .gte('end_date', from)
    .lte('end_date', to)
    .limit(200)
  for (const c of contracts ?? []) {
    events.push({
      id: c.id, source: 'contract', title: `${c.title} ends`, date: c.end_date,
      status: c.status, badge: 'contract', href: `/contracts/${c.id}`, color: 'orange',
    })
  }

  // Deal expected close dates
  const { data: deals } = await supabaseAdmin
    .from('crm_deals')
    .select('id, title, deal_status, expected_close, deal_value')
    .eq('org_id', orgId)
    .not('expected_close', 'is', null)
    .gte('expected_close', from)
    .lte('expected_close', to)
    .eq('deal_status', 'open')
    .limit(200)
  for (const d of deals ?? []) {
    events.push({
      id: d.id, source: 'deal', title: `${d.title} target`, date: d.expected_close,
      status: d.deal_status, badge: 'deal', href: `/deals/${d.id}`, color: 'blue',
    })
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ data: events, range: { from, to } })
}
