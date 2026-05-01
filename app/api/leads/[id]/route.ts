import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId } = session!.user
  const { id } = await params

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_leads')
    .select(`
      *, crm_users!assigned_to(id, full_name, email),
      crm_contacts!converted_to(id, first_name, last_name)
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  return NextResponse.json({ data })
}

const LEAD_ALLOWED = [
  'first_name', 'last_name', 'email', 'phone', 'company', 'job_title',
  'lead_source', 'lead_status', 'rating', 'ai_score', 'assigned_to',
  'notes', 'tags', 'custom_fields',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: actorId } = session!.user
  const { id } = await params
  const body = await req.json()

  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => LEAD_ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'lead.updated', resource_type: 'crm_lead', resource_id: id, meta: updates })

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbError } = await supabaseAdmin
    .from('crm_leads')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'lead.deleted', resource_type: 'crm_lead', resource_id: id })

  return NextResponse.json({ success: true })
}
