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

  // ─── 1. Auto-generate invoices for subscriptions due today ───
  const { data: dueSubs } = await supabaseAdmin
    .from('crm_subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('next_billing_date', today)
    .limit(500)

  let subsBilled = 0
  for (const sub of dueSubs ?? []) {
    // Skip if subscription has expired
    if (sub.end_date && sub.end_date < today) {
      await supabaseAdmin.from('crm_subscriptions').update({ status: 'expired' }).eq('id', sub.id)
      continue
    }

    const { data: invNum } = await supabaseAdmin.rpc('next_doc_number', { p_org_id: sub.org_id, p_type: 'invoice', p_prefix: 'INV' })
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + Number(sub.payment_terms_days ?? 7))
    const subtotal = Number(sub.amount)
    const taxPct = Number(sub.tax_pct ?? 0)
    const total = Math.round(subtotal * (1 + taxPct / 100))

    const { error: invErr } = await supabaseAdmin.from('crm_invoices').insert({
      org_id: sub.org_id,
      invoice_number: invNum,
      account_id: sub.account_id,
      contact_id: sub.contact_id,
      status: 'sent',
      issue_date: today,
      due_date: dueDate.toISOString().split('T')[0],
      items: [{ description: `${sub.name} (${sub.subscription_number})`, qty: 1, rate: subtotal, total: subtotal }],
      subtotal, tax_pct: taxPct, total,
      currency: sub.currency,
      notes: `Recurring invoice from subscription ${sub.subscription_number}`,
    })
    if (invErr) continue

    const { data: nextDate } = await supabaseAdmin.rpc('compute_next_billing_date', {
      p_current: sub.next_billing_date, p_cycle: sub.billing_cycle, p_cycle_days: sub.cycle_days,
    })
    await supabaseAdmin.from('crm_subscriptions').update({
      last_billed_at: new Date().toISOString(),
      next_billing_date: nextDate,
      invoices_generated: Number(sub.invoices_generated ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', sub.id)

    subsBilled++
  }

  // ─── 2. Mark sent invoices as overdue if past due_date ───
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

  return NextResponse.json({ subsBilled, markedOverdue: count ?? 0, automationsFired })
}
