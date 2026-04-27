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
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 50)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('crm_vendors')
    .select('id, name, contact_name, email, phone, category, status, rating, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1)

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

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
  if (!body.name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_vendors')
    .insert({ ...body, org_id: orgId, created_by: actorId, status: body.status ?? 'active' })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'vendor.created', resource_type: 'crm_vendor', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
