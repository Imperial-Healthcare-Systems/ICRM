import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('crm_purchase_orders')
    .select(`
      id, po_number, status, issue_date, expected_date, total, currency, created_at,
      crm_vendors!vendor_id(name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { data: poNum } = await supabaseAdmin
    .rpc('next_doc_number', { p_org_id: orgId, p_type: 'purchase_order', p_prefix: 'PO' })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_purchase_orders')
    .insert({
      ...body,
      org_id: orgId,
      po_number: poNum ?? `PO-${Date.now()}`,
      created_by: actorId,
      status: body.status ?? 'draft',
    })
    .select('id, po_number')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'po.created', resource_type: 'crm_purchase_order', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
