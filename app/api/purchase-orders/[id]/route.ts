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
    .from('crm_purchase_orders')
    .select(`*, crm_vendors!vendor_id(id,name,email,phone)`)
    .eq('id', id).eq('org_id', orgId).single()

  if (dbError || !data) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params
  const body = await req.json()

  const ALLOWED = ['vendor_id', 'status', 'issue_date', 'expected_date', 'received_date', 'items', 'subtotal', 'tax_pct', 'total', 'currency', 'notes']
  const updates: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  updates.updated_at = new Date().toISOString()
  if (body.status === 'received' && !body.received_date) {
    updates.received_date = new Date().toISOString().split('T')[0]
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_purchase_orders')
    .update(updates)
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'po.updated', resource_type: 'crm_purchase_order', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbError } = await supabaseAdmin.from('crm_purchase_orders').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'po.deleted', resource_type: 'crm_purchase_order', resource_id: id })
  return NextResponse.json({ success: true })
}
