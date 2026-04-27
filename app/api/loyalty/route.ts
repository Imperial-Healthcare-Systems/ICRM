import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

function calcTier(points: number): string {
  if (points >= 10000) return 'platinum'
  if (points >= 5000) return 'gold'
  if (points >= 1000) return 'silver'
  return 'bronze'
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'))
  const from = (page - 1) * pageSize

  const { data, count, error: dbErr } = await supabaseAdmin
    .from('crm_loyalty_accounts')
    .select(`*, crm_contacts(first_name,last_name,email), crm_accounts(name)`, { count: 'exact' })
    .eq('org_id', orgId)
    .order('points_balance', { ascending: false })
    .range(from, from + pageSize - 1)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { contact_id, account_id, points = 0, description, type = 'earn', reference_id } = body

  if (!contact_id && !account_id)
    return NextResponse.json({ error: 'contact_id or account_id is required' }, { status: 400 })

  const lookupKey = contact_id ? { contact_id } : { account_id }

  const { data: existing } = await supabaseAdmin.from('crm_loyalty_accounts')
    .select('*').eq('org_id', orgId).match(lookupKey).maybeSingle()

  let loyaltyAccount = existing

  if (!loyaltyAccount) {
    const { data: created, error: createErr } = await supabaseAdmin.from('crm_loyalty_accounts').insert({
      org_id: orgId,
      contact_id: contact_id || null, account_id: account_id || null,
      points_balance: 0, tier: 'bronze', total_earned: 0, total_redeemed: 0,
    }).select().single()
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    loyaltyAccount = created
  }

  const delta = type === 'redeem' ? -Math.abs(points) : Math.abs(points)
  const newBalance = Math.max(0, loyaltyAccount.points_balance + delta)
  const newEarned = type === 'earn' ? loyaltyAccount.total_earned + Math.abs(points) : loyaltyAccount.total_earned
  const newRedeemed = type === 'redeem' ? loyaltyAccount.total_redeemed + Math.abs(points) : loyaltyAccount.total_redeemed
  const newTier = calcTier(newBalance)

  await supabaseAdmin.from('crm_loyalty_accounts').update({
    points_balance: newBalance, tier: newTier,
    total_earned: newEarned, total_redeemed: newRedeemed,
    updated_at: new Date().toISOString(),
  }).eq('id', loyaltyAccount.id)

  const { data: txn, error: txnErr } = await supabaseAdmin.from('crm_loyalty_transactions').insert({
    org_id: orgId, loyalty_account_id: loyaltyAccount.id,
    type, points: Math.abs(points), description,
    reference_id: reference_id || null, created_by: userId,
  }).select().single()

  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'loyalty_transaction', resource_id: txn.id })
  return NextResponse.json({ data: txn, balance: newBalance, tier: newTier }, { status: 201 })
}
