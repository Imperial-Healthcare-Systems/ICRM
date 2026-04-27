import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const pageSize = Math.min(50, Number(url.searchParams.get('pageSize') ?? 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabaseAdmin
    .from('crm_email_sequences')
    .select('id, name, description, status, created_at, updated_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data, count } = await query
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { name, description } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_email_sequences')
    .insert({ org_id: orgId, name: name.trim(), description: description ?? null, status: 'draft', created_by: actorId })
    .select('id, name, status')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Failed to create sequence.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'email_sequence.created', resource_type: 'crm_email_sequence', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
