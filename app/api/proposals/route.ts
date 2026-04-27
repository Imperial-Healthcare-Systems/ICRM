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
    .from('crm_proposals')
    .select(`
      id, proposal_number, title, status, valid_until, total, currency, created_at,
      crm_accounts!account_id(name),
      crm_contacts!contact_id(first_name, last_name)
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
  if (!body.title) return NextResponse.json({ error: 'title is required.' }, { status: 400 })

  const { data: propNum } = await supabaseAdmin
    .rpc('next_doc_number', { p_org_id: orgId, p_type: 'proposal', p_prefix: 'PRO' })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_proposals')
    .insert({
      ...body,
      org_id: orgId,
      proposal_number: propNum ?? `PRO-${Date.now()}`,
      created_by: actorId,
      status: body.status ?? 'draft',
    })
    .select('id, proposal_number')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'proposal.created', resource_type: 'crm_proposal', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
