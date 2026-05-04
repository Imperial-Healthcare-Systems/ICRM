import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = ['target_amount', 'period_end', 'territory_id', 'metric', 'notes', 'currency']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_quotas')
    .select(`*, crm_users!user_id(id, full_name, email), crm_territories!territory_id(id, name)`)
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbErr || !data) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: achieved } = await supabaseAdmin.rpc('quota_achievement', { p_quota_id: id })
  return NextResponse.json({ data: { ...data, achieved: Number(achieved ?? 0) } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin', 'manager'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in body) update[k] = body[k]
  if (update.target_amount !== undefined) {
    const n = Number(update.target_amount)
    if (!n || n <= 0) return NextResponse.json({ error: 'Target must be positive.' }, { status: 400 })
    update.target_amount = n
  }
  update.updated_at = new Date().toISOString()

  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_quotas')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id')
    .single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Update failed.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quota.updated', resource_type: 'crm_quota', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { error: dbErr } = await supabaseAdmin
    .from('crm_quotas')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quota.deleted', resource_type: 'crm_quota', resource_id: id })
  return NextResponse.json({ ok: true })
}
