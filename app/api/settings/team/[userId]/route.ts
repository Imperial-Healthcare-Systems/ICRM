import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role: actorRole } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { userId } = await params
  const body = await req.json()

  const isSelf = userId === actorId

  // Self-update: only full_name and avatar_url allowed
  if (isSelf) {
    const selfAllowed = ['full_name', 'avatar_url']
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => selfAllowed.includes(k)))
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

    const { data, error: dbError } = await supabaseAdmin
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

  // Prevent self-demotion or self-deactivation via admin path (belt-and-suspenders)
  if (body.role || body.is_active === false) {
    if (userId === actorId) return NextResponse.json({ error: 'Cannot modify your own role or status.' }, { status: 400 })
  }

  // Prevent non-super-admin from creating super_admin
  if (body.role === 'super_admin' && actorRole !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can assign super_admin role.' }, { status: 403 })
  }

  const allowed = ['role', 'is_active']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
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
