import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId, role: actorRole } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { userId } = await params
  const body = await req.json()

  const isSelf = userId === actorId

  if (isSelf) {
    const selfAllowed = ['full_name', 'avatar_url']
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => selfAllowed.includes(k)))
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

    const { data, error: dbError } = await supabase
      .from('crm_users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('org_id', orgId)
      .select('id, full_name, avatar_url, role, is_active')
      .single()

    if (dbError || !data) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    logAudit({ org_id: orgId, actor_id: actorId, action: 'profile.updated', resource_type: 'crm_user', resource_id: userId, meta: updates })
    return NextResponse.json({ data })
  }

  if (!['super_admin', 'admin'].includes(actorRole)) {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  if (body.role || body.is_active === false) {
    if (userId === actorId) return NextResponse.json({ error: 'Cannot modify your own role or status.' }, { status: 400 })
  }

  if (body.role === 'super_admin' && actorRole !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can assign super_admin role.' }, { status: 403 })
  }

  const allowed = ['role', 'is_active']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbError } = await supabase
    .from('crm_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('org_id', orgId)
    .select('id, full_name, role, is_active')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'team.updated', resource_type: 'crm_user', resource_id: userId, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId, role: actorRole } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  if (actorRole !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can delete team members.' }, { status: 403 })
  }

  const { userId } = await params

  if (userId === actorId) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('crm_users')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .eq('org_id', orgId)
    .single()

  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  if (target.role === 'super_admin') {
    const { count } = await supabase
      .from('crm_users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'super_admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last super admin.' }, { status: 400 })
    }
  }

  const { error: dbError } = await supabase
    .from('crm_users')
    .delete()
    .eq('id', userId)
    .eq('org_id', orgId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'team.deleted',
    resource_type: 'crm_user',
    resource_id: userId,
    meta: { email: target.email, full_name: target.full_name, role: target.role },
  })

  return NextResponse.json({ ok: true })
}
