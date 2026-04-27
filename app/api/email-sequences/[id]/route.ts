import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_email_sequences')
    .select(`
      id, name, description, status, created_at,
      crm_email_sequence_steps(id, step_order, delay_days, subject, body)
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .order('step_order', { referencedTable: 'crm_email_sequence_steps', ascending: true })
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Sequence not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()

  const allowed = ['name', 'description', 'status']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_email_sequences')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, name, status')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Sequence not found.' }, { status: 404 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'email_sequence.updated', resource_type: 'crm_email_sequence', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params

  const { error: dbError } = await supabaseAdmin
    .from('crm_email_sequences')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) return NextResponse.json({ error: 'Delete failed.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'email_sequence.deleted', resource_type: 'crm_email_sequence', resource_id: id })
  return NextResponse.json({ success: true })
}
