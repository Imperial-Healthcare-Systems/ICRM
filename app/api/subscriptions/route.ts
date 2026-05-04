import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''

  let q = supabaseAdmin
    .from('crm_subscriptions')
    .select(`
      id, subscription_number, name, amount, currency, tax_pct, billing_cycle, status,
      start_date, end_date, next_billing_date, invoices_generated, auto_renew, created_at,
      crm_accounts!account_id(id, name),
      crm_contacts!contact_id(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('next_billing_date', { ascending: true })
    .limit(200)
  if (status) q = q.eq('status', status)

  const { data, count } = await q
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!body.account_id) return NextResponse.json({ error: 'Account is required.' }, { status: 400 })
  if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  if (!body.start_date) return NextResponse.json({ error: 'Start date is required.' }, { status: 400 })

  const startDate = body.start_date as string
  const cycle = body.billing_cycle ?? 'monthly'

  // First billing date = start_date
  const nextBilling = body.next_billing_date ?? startDate

  // Subscription number
  const { data: numData } = await supabaseAdmin.rpc('next_doc_number', { p_org_id: orgId, p_type: 'subscription', p_prefix: 'SUB' })
  const subscription_number = numData ?? `SUB-${Date.now()}`

  const { data, error: dbErr } = await supabaseAdmin.from('crm_subscriptions').insert({
    org_id: orgId,
    subscription_number,
    account_id: body.account_id,
    contact_id: body.contact_id || null,
    product_id: body.product_id || null,
    name: body.name.trim(),
    description: body.description ?? null,
    amount: Number(body.amount),
    currency: body.currency ?? 'INR',
    tax_pct: body.tax_pct != null ? Number(body.tax_pct) : 18,
    billing_cycle: cycle,
    cycle_days: cycle === 'custom' && body.cycle_days ? Number(body.cycle_days) : null,
    status: 'active',
    start_date: startDate,
    end_date: body.end_date || null,
    next_billing_date: nextBilling,
    auto_renew: body.auto_renew ?? true,
    payment_terms_days: body.payment_terms_days ?? 7,
    notes: body.notes ?? null,
    created_by: actorId,
  }).select('id, subscription_number, name').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'subscription.created', resource_type: 'crm_subscription', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
