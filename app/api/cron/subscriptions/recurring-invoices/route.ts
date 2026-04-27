import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  // Mark sent invoices as overdue if past due_date
  const { data: updatedInvoices } = await supabaseAdmin
    .from('crm_invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .eq('status', 'sent')
    .lt('due_date', today)
    .select('id')
  const count = updatedInvoices?.length ?? 0

  // Find automation rules for invoice.overdue
  const { data: overdueInvoices } = await supabaseAdmin
    .from('crm_invoices')
    .select('id, org_id, invoice_number, total, due_date')
    .eq('status', 'overdue')
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(200)

  let automationsFired = 0

  for (const inv of overdueInvoices ?? []) {
    const { data: rules } = await supabaseAdmin
      .from('crm_automation_rules')
      .select('id, org_id, action_type, action_config')
      .eq('org_id', inv.org_id)
      .eq('trigger_event', 'invoice.overdue')
      .eq('is_active', true)

    for (const rule of rules ?? []) {
      const { data: existing } = await supabaseAdmin
        .from('crm_automation_executions')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('resource_id', inv.id)
        .single()

      if (existing) continue

      if (rule.action_type === 'add_note') {
        await supabaseAdmin.from('crm_notes').insert({
          org_id: inv.org_id,
          content: `⚠️ Invoice ${inv.invoice_number} is overdue (was due ${inv.due_date}).`,
          related_to_type: 'deal',
          related_to_id: inv.id,
        })
      }

      if (rule.action_type === 'create_activity') {
        await supabaseAdmin.from('crm_activities').insert({
          org_id: inv.org_id,
          activity_type: 'follow_up',
          subject: `Follow up on overdue invoice ${inv.invoice_number}`,
          status: 'pending',
        })
      }

      await supabaseAdmin.from('crm_automation_executions').upsert({
        org_id: inv.org_id, rule_id: rule.id, resource_id: inv.id,
      }, { onConflict: 'rule_id,resource_id', ignoreDuplicates: true })

      await supabaseAdmin.rpc('increment_rule_run_count', { p_rule_id: rule.id })

      automationsFired++
    }
  }

  return NextResponse.json({ markedOverdue: count ?? 0, automationsFired })
}
