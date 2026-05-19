import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = ['name', 'description', 'amount', 'currency', 'tax_pct', 'billing_cycle', 'cycle_days', 'end_date', 'next_billing_date', 'auto_renew', 'payment_terms_days', 'notes', 'contact_id', 'product_id']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user
  const { id } = await params
  const { data } = await supabase.from('crm_subscriptions')
    .select(`*,
      crm_accounts!account_id(id, name),
      crm_contacts!contact_id(id, first_name, last_name),
      crm_products!product_id(id, name)
    `)
    .eq('id', id).eq('org_id', orgId).single()
  if (!data) return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('crm_subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'subscription.updated', resource_type: 'crm_subscription', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user
  const { id } = await params
  const { error: dbErr } = await supabase.from('crm_subscriptions').delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'subscription.deleted', resource_type: 'crm_subscription', resource_id: id })
  return NextResponse.json({ success: true })
}
