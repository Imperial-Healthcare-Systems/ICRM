import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error

  const { orgId, id: actorId } = session.user
  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  if (body.status === 'completed' && !body.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error: dbError } = await supabase
    .from('crm_activities')
    .update(updates)
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbError || !data) return NextResponse.json({ error: 'Activity not found.' }, { status: 404 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'activity.updated', resource_type: 'crm_activity', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error

  const { orgId, id: actorId } = session.user
  const { id } = await params

  const { error: dbError } = await supabase.from('crm_activities').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'activity.deleted', resource_type: 'crm_activity', resource_id: id })
  return NextResponse.json({ success: true })
}
