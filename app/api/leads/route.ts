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
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabaseAdmin
    .from('crm_leads')
    .select(`
      id, first_name, last_name, email, phone, company, job_title,
      lead_source, lead_status, rating, ai_score, assigned_to,
      created_at, updated_at,
      crm_users!assigned_to(full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('lead_status', status)
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)

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
  const { first_name, last_name, email, phone, company, job_title,
    lead_source, lead_status, rating, assigned_to, notes, tags } = body

  if (!first_name) return NextResponse.json({ error: 'first_name is required.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_leads')
    .insert({
      org_id: orgId,
      first_name, last_name, email, phone, company, job_title,
      lead_source, lead_status: lead_status ?? 'new',
      rating: rating ?? 'warm',
      assigned_to: assigned_to ?? actorId,
      notes, tags,
      created_by: actorId,
    })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'lead.created', resource_type: 'crm_lead', resource_id: data.id })

  return NextResponse.json({ data }, { status: 201 })
}
