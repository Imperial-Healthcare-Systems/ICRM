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
    .from('crm_quotations')
    .select(`*, crm_accounts!account_id(id,name), crm_contacts!contact_id(id,first_name,last_name), crm_deals!deal_id(id,title)`)
    .eq('id', id).eq('org_id', orgId).single()

  if (dbError || !data) return NextResponse.json({ error: 'Quotation not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params
  const body = await req.json()

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_quotations')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbError || !data) return NextResponse.json({ error: 'Quotation not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'quotation.updated', resource_type: 'crm_quotation', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbError } = await supabaseAdmin.from('crm_quotations').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'quotation.deleted', resource_type: 'crm_quotation', resource_id: id })
  return NextResponse.json({ success: true })
}
