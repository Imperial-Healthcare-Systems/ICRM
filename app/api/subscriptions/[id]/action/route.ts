import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

/* POST { action: 'pause'|'resume'|'cancel'|'generate_invoice', reason? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const action = body.action as string

  const { data: sub } = await supabaseAdmin
    .from('crm_subscriptions')
    .select('*, crm_accounts!account_id(id, name), crm_contacts!contact_id(id)')
    .eq('id', id).eq('org_id', orgId).single()
  if (!sub) return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 })

  const now = new Date()
  const updates: Record<string, unknown> = { updated_at: now.toISOString() }

  if (action === 'pause') {
    if (sub.status !== 'active') return NextResponse.json({ error: `Cannot pause a ${sub.status} subscription.` }, { status: 400 })
    updates.status = 'paused'
  } else if (action === 'resume') {
    if (sub.status !== 'paused') return NextResponse.json({ error: 'Only paused subscriptions can be resumed.' }, { status: 400 })
    updates.status = 'active'
  } else if (action === 'cancel') {
    if (['cancelled', 'expired'].includes(sub.status)) return NextResponse.json({ error: `Already ${sub.status}.` }, { status: 400 })
    updates.status = 'cancelled'
    updates.cancellation_reason = body.reason?.trim() || null
    updates.cancelled_at = now.toISOString()
    updates.auto_renew = false
  } else if (action === 'generate_invoice') {
    // Manual on-demand invoice generation
    return generateInvoice(orgId, actorId, sub, now)
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  await supabaseAdmin.from('crm_subscriptions').update(updates).eq('id', id).eq('org_id', orgId)
  logAudit({ org_id: orgId, actor_id: actorId, action: `subscription.${action}d`, resource_type: 'crm_subscription', resource_id: id })
  return NextResponse.json({ success: true, status: updates.status })
}

async function generateInvoice(orgId: string, actorId: string, sub: Record<string, unknown>, now: Date) {
  const { data: invNum } = await supabaseAdmin.rpc('next_doc_number', { p_org_id: orgId, p_type: 'invoice', p_prefix: 'INV' })
  const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + Number(sub.payment_terms_days ?? 7))

  const subtotal = Number(sub.amount)
  const taxPct = Number(sub.tax_pct ?? 0)
  const total = Math.round(subtotal * (1 + taxPct / 100))

  const { data: invoice, error: invErr } = await supabaseAdmin.from('crm_invoices').insert({
    org_id: orgId,
    invoice_number: invNum,
    account_id: sub.account_id,
    contact_id: sub.contact_id,
    status: 'sent',
    issue_date: now.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    items: [{ description: `${sub.name} (${sub.subscription_number})`, qty: 1, rate: subtotal, total: subtotal }],
    subtotal,
    tax_pct: taxPct,
    total,
    currency: sub.currency,
    notes: `Recurring invoice from subscription ${sub.subscription_number}`,
    created_by: actorId,
  }).select('id, invoice_number, total').single()

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? 'Failed to create invoice.' }, { status: 500 })

  // Bump next_billing_date and counters
  const { data: nextDate } = await supabaseAdmin.rpc('compute_next_billing_date', {
    p_current: sub.next_billing_date, p_cycle: sub.billing_cycle, p_cycle_days: sub.cycle_days,
  })

  await supabaseAdmin.from('crm_subscriptions').update({
    last_billed_at: now.toISOString(),
    next_billing_date: nextDate,
    invoices_generated: Number(sub.invoices_generated ?? 0) + 1,
    updated_at: now.toISOString(),
  }).eq('id', sub.id)

  logAudit({ org_id: orgId, actor_id: actorId, action: 'subscription.invoice_generated', resource_type: 'crm_subscription', resource_id: String(sub.id), meta: { invoice_id: invoice.id } })
  return NextResponse.json({ data: invoice }, { status: 201 })
}
