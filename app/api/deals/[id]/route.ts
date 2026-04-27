import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { emitEvent } from '@/lib/ecosystem'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId } = session!.user
  const { id } = await params

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_deals')
    .select(`
      *, crm_users!assigned_to(id, full_name),
      crm_accounts!account_id(id, name),
      crm_contacts!contact_id(id, first_name, last_name),
      crm_pipeline_stages!stage_id(id, name, color, probability)
    `)
    .eq('id', id).eq('org_id', orgId).single()

  if (dbError || !data) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: actorId } = session!.user
  const { id } = await params
  const body = await req.json()

  // Fetch current deal to detect status transition
  const { data: current } = await supabaseAdmin
    .from('crm_deals')
    .select('deal_status, title, deal_value, crm_accounts!account_id(name)')
    .eq('id', id).eq('org_id', orgId).single()

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_deals')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbError || !data) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 })

  // Emit ecosystem event when deal is won
  if (body.deal_status === 'won' && current?.deal_status !== 'won') {
    emitEvent({
      event_type: 'deal.won',
      source: 'icrm',
      org_id: orgId,
      payload: {
        deal_id: id,
        title: current?.title,
        value: current?.deal_value,
        account: (current?.crm_accounts as any)?.name,
        closed_by: actorId,
      },
    })

    await supabaseAdmin
      .from('crm_deals')
      .update({ actual_close: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId)
  }

  logAudit({ org_id: orgId, actor_id: actorId, action: 'deal.updated', resource_type: 'crm_deal', resource_id: id, meta: body })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbError } = await supabaseAdmin.from('crm_deals').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'deal.deleted', resource_type: 'crm_deal', resource_id: id })
  return NextResponse.json({ success: true })
}
