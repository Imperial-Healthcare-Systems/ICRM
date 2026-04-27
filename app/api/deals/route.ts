import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { emitEvent } from '@/lib/ecosystem'
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
  const view = searchParams.get('view') ?? 'list'

  let query = supabaseAdmin
    .from('crm_deals')
    .select(`
      id, title, deal_value, currency, probability, deal_status,
      expected_close, actual_close, assigned_to, stage_id, created_at,
      crm_accounts!account_id(id, name),
      crm_contacts!contact_id(id, first_name, last_name),
      crm_pipeline_stages!stage_id(id, name, color, position, is_won, is_lost),
      crm_users!assigned_to(full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('deal_status', status)
  if (search) query = query.ilike('title', `%${search}%`)

  if (view === 'kanban') {
    query = query.eq('deal_status', 'open').limit(200)
  } else {
    const page = Number(searchParams.get('page') ?? 1)
    const pageSize = Number(searchParams.get('pageSize') ?? 20)
    query = query.range((page - 1) * pageSize, page * pageSize - 1)
  }

  const { data, count, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: actorId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.title) return NextResponse.json({ error: 'title is required.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_deals')
    .insert({
      ...body,
      org_id: orgId,
      created_by: actorId,
      assigned_to: body.assigned_to ?? actorId,
      deal_status: body.deal_status ?? 'open',
    })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'deal.created', resource_type: 'crm_deal', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
