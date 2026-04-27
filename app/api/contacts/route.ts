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
  const search = searchParams.get('search')
  const accountId = searchParams.get('account_id')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('crm_contacts')
    .select(`
      id, first_name, last_name, email, phone, mobile, job_title, department,
      contact_source, lead_status, assigned_to, account_id, created_at,
      crm_users!assigned_to(full_name),
      crm_accounts!account_id(name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  if (accountId) query = query.eq('account_id', accountId)

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
  const { first_name } = body
  if (!first_name) return NextResponse.json({ error: 'first_name is required.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_contacts')
    .insert({ ...body, org_id: orgId, created_by: actorId, assigned_to: body.assigned_to ?? actorId })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'contact.created', resource_type: 'crm_contact', resource_id: data.id })

  return NextResponse.json({ data }, { status: 201 })
}
