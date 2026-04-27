import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function executeAction(
  rule: { id: string; org_id: string; action_type: string; action_config: Record<string, unknown> },
  resourceId: string,
  context: Record<string, unknown>
) {
  const cfg = rule.action_config

  if (rule.action_type === 'create_activity') {
    await supabaseAdmin.from('crm_activities').insert({
      org_id: rule.org_id,
      activity_type: (cfg.activity_type as string) ?? 'task',
      subject: (cfg.subject as string) ?? 'Automation triggered task',
      description: cfg.description as string ?? null,
      status: 'pending',
      related_to_type: cfg.related_to_type as string ?? null,
      related_to_id: resourceId,
      assigned_to: cfg.assigned_to as string ?? null,
    })
  }

  if (rule.action_type === 'add_note') {
    await supabaseAdmin.from('crm_notes').insert({
      org_id: rule.org_id,
      content: ((cfg.content as string) ?? 'Automation note').replace(/\{(\w+)\}/g, (_, k) => String(context[k] ?? '')),
      related_to_type: cfg.related_to_type as string ?? null,
      related_to_id: resourceId,
    })
  }

  if (rule.action_type === 'create_ticket') {
    const { data: seq } = await supabaseAdmin.rpc('next_doc_number', {
      p_org_id: rule.org_id, p_type: 'ticket',
    })
    await supabaseAdmin.from('crm_tickets').insert({
      org_id: rule.org_id,
      ticket_number: seq,
      title: ((cfg.title as string) ?? 'Automation ticket').replace(/\{(\w+)\}/g, (_, k) => String(context[k] ?? '')),
      description: cfg.description as string ?? null,
      priority: (cfg.priority as string) ?? 'medium',
      type: (cfg.type as string) ?? 'general',
    })
  }

  if (rule.action_type === 'send_webhook') {
    const url = cfg.url as string
    if (url) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: rule.id, resource_id: resourceId, context }),
      }).catch(() => null)
    }
  }

  // Log execution to prevent re-running
  await supabaseAdmin.from('crm_automation_executions').upsert({
    org_id: rule.org_id,
    rule_id: rule.id,
    resource_id: resourceId,
  }, { onConflict: 'rule_id,resource_id', ignoreDuplicates: true })

  // Increment run_count
  await supabaseAdmin.rpc('increment_rule_run_count', { p_rule_id: rule.id })
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Fetch unprocessed ecosystem events from last 5 minutes
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: events } = await supabaseAdmin
    .from('ecosystem_events')
    .select('id, event_type, org_id, payload')
    .eq('processed', false)
    .gte('created_at', since)
    .limit(100)

  if (!events?.length) return NextResponse.json({ processed: 0 })

  let processed = 0

  for (const ev of events) {
    // Find matching active automation rules for this org + event
    const { data: rules } = await supabaseAdmin
      .from('crm_automation_rules')
      .select('id, org_id, action_type, action_config')
      .eq('org_id', ev.org_id)
      .eq('trigger_event', ev.event_type)
      .eq('is_active', true)

    if (rules?.length) {
      const resourceId = (ev.payload as Record<string, unknown>)?.deal_id as string
        ?? (ev.payload as Record<string, unknown>)?.contact_id as string
        ?? ev.id

      for (const rule of rules) {
        await executeAction(rule, resourceId, ev.payload as Record<string, unknown>).catch(() => null)
      }
    }

    // Mark event as processed
    await supabaseAdmin.from('ecosystem_events').update({ processed: true }).eq('id', ev.id)
    processed++
  }

  return NextResponse.json({ processed })
}
