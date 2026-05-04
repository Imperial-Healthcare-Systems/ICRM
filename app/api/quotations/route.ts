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
  const search = searchParams.get('search')
  const isEstimate = searchParams.get('is_estimate')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('crm_quotations')
    .select(`
      id, quote_number, status, valid_until, total, currency, created_at, is_estimate,
      crm_accounts!account_id(name),
      crm_contacts!contact_id(first_name, last_name),
      crm_users!created_by(full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (search) query = query.or(`quote_number.ilike.%${search}%`)
  if (isEstimate === 'true') query = query.eq('is_estimate', true)
  else if (isEstimate === 'false') query = query.or('is_estimate.is.null,is_estimate.eq.false')

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

  const isEstimate = body.is_estimate === true
  const docType = isEstimate ? 'estimate' : 'quotation'
  const docPrefix = isEstimate ? 'EST' : 'QT'

  // Auto-generate quote number
  const { data: numData } = await supabaseAdmin
    .rpc('next_doc_number', { p_org_id: orgId, p_type: docType, p_prefix: docPrefix })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_quotations')
    .insert({
      ...body,
      org_id: orgId,
      quote_number: numData ?? `${docPrefix}-${Date.now()}`,
      created_by: actorId,
      status: body.status ?? 'draft',
    })
    .select('id, quote_number')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quotation.created', resource_type: 'crm_quotation', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
