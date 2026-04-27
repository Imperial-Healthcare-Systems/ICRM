import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'))
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const from = (page - 1) * pageSize

  let q = supabaseAdmin
    .from('crm_campaigns')
    .select(`*, crm_users!created_by(full_name)`, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) q = q.eq('status', status)
  if (type) q = q.eq('type', type)

  const { data, count, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { name, type = 'email', subject, body: emailBody, from_name, scheduled_at, target_segment } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_campaigns').insert({
    org_id: orgId,
    name: name.trim(), type, status: 'draft',
    subject, body: emailBody, from_name,
    scheduled_at: scheduled_at || null,
    target_segment: target_segment || {},
    created_by: userId,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'campaign', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
