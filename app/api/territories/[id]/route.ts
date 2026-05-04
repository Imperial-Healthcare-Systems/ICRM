import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = ['name', 'description', 'parent_id', 'regions', 'manager_id', 'member_ids', 'is_active']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data } = await supabaseAdmin.from('crm_territories')
    .select(`*, manager:crm_users!manager_id(id, full_name, email)`)
    .eq('id', id).eq('org_id', orgId).single()
  if (!data) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_territories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'territory.updated', resource_type: 'crm_territory', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const { id } = await params
  const { error: dbErr } = await supabaseAdmin.from('crm_territories').delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'territory.deleted', resource_type: 'crm_territory', resource_id: id })
  return NextResponse.json({ success: true })
}
