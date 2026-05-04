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
  const userId = url.searchParams.get('user_id') ?? ''
  const periodStart = url.searchParams.get('period_start') ?? ''

  let q = supabaseAdmin
    .from('crm_quotas')
    .select(`*, crm_users!user_id(id, full_name), crm_territories!territory_id(id, name)`)
    .eq('org_id', orgId)
    .order('period_start', { ascending: false })
    .limit(200)
  if (userId) q = q.eq('user_id', userId)
  if (periodStart) q = q.eq('period_start', periodStart)

  const { data: quotas } = await q

  // Compute achievement for each quota in parallel
  const enriched = await Promise.all((quotas ?? []).map(async (qt) => {
    const { data: achieved } = await supabaseAdmin.rpc('quota_achievement', { p_quota_id: qt.id })
    return { ...qt, achieved: Number(achieved ?? 0) }
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin', 'manager'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.user_id) return NextResponse.json({ error: 'User is required.' }, { status: 400 })
  if (!body.period_start || !body.period_end) return NextResponse.json({ error: 'Period dates are required.' }, { status: 400 })
  if (!Number(body.target_amount) || Number(body.target_amount) <= 0) return NextResponse.json({ error: 'Target must be positive.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_quotas').insert({
    org_id: orgId,
    user_id: body.user_id,
    territory_id: body.territory_id || null,
    period_type: body.period_type ?? 'monthly',
    period_start: body.period_start,
    period_end: body.period_end,
    target_amount: Number(body.target_amount),
    currency: body.currency ?? 'INR',
    metric: body.metric ?? 'revenue',
    notes: body.notes ?? null,
    created_by: actorId,
  }).select('id').single()

  if (dbErr || !data) {
    if (dbErr?.code === '23505') return NextResponse.json({ error: 'Quota already exists for this user/period/metric.' }, { status: 409 })
    return NextResponse.json({ error: dbErr?.message ?? 'Failed.' }, { status: 500 })
  }

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quota.created', resource_type: 'crm_quota', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
