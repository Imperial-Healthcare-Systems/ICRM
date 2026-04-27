import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_field_visits')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name,email,phone), crm_users!assigned_to(full_name)`)
    .eq('id', id).eq('org_id', orgId).single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed = ['title','status','scheduled_at','completed_at','location','notes','outcome','assigned_to','account_id','contact_id']
  for (const k of allowed) if (k in body) updates[k] = body[k]
  if (body.status === 'completed' && !updates.completed_at) updates.completed_at = new Date().toISOString()

  const { data, error: dbErr } = await supabaseAdmin.from('crm_field_visits')
    .update(updates).eq('id', id).eq('org_id', orgId).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'update', resource_type: 'field_visit', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const { id } = await params
  const { error: dbErr } = await supabaseAdmin.from('crm_field_visits')
    .delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'delete', resource_type: 'field_visit', resource_id: id })
  return NextResponse.json({ success: true })
}
