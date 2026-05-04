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
  const search = url.searchParams.get('search')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 20))
  const from = (page - 1) * pageSize, to = from + pageSize - 1

  let q = supabaseAdmin
    .from('crm_projects')
    .select(`
      id, name, status, priority, start_date, end_date, budget, currency, is_billable, created_at,
      crm_accounts!account_id(id, name),
      crm_users!owner_id(id, full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('name', `%${search}%`)

  const { data, count } = await q
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_projects').insert({
    org_id: orgId,
    name: body.name.trim(),
    description: body.description ?? null,
    account_id: body.account_id || null,
    deal_id: body.deal_id || null,
    status: body.status ?? 'planning',
    priority: body.priority ?? 'medium',
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    budget: body.budget ? Number(body.budget) : null,
    currency: body.currency ?? 'INR',
    hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : null,
    is_billable: body.is_billable ?? true,
    owner_id: body.owner_id || actorId,
    notes: body.notes ?? null,
    created_by: actorId,
  }).select('id, name').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to create project.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'project.created', resource_type: 'crm_project', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
