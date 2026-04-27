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
    .from('crm_campaigns')
    .select(`*, crm_users!created_by(full_name)`)
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
  const allowed = ['name','type','status','subject','body','from_name','scheduled_at',
    'recipient_count','open_count','click_count','bounce_count','unsubscribe_count','target_segment']
  for (const k of allowed) if (k in body) updates[k] = body[k]
  if (body.status === 'sent' && !updates.sent_at) updates.sent_at = new Date().toISOString()

  const { data, error: dbErr } = await supabaseAdmin.from('crm_campaigns')
    .update(updates).eq('id', id).eq('org_id', orgId).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'update', resource_type: 'campaign', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const { id } = await params
  const { error: dbErr } = await supabaseAdmin.from('crm_campaigns')
    .delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'delete', resource_type: 'campaign', resource_id: id })
  return NextResponse.json({ success: true })
}
