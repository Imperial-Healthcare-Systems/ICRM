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
  const type = searchParams.get('activity_type')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('crm_activities')
    .select(`
      id, activity_type, subject, description, status, due_date,
      completed_at, duration_mins, related_to_type, related_to_id,
      assigned_to, created_at,
      crm_users!assigned_to(full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('activity_type', type)

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
  if (!body.subject || !body.activity_type) {
    return NextResponse.json({ error: 'subject and activity_type are required.' }, { status: 400 })
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_activities')
    .insert({
      ...body,
      org_id: orgId,
      created_by: actorId,
      assigned_to: body.assigned_to ?? actorId,
      status: body.status ?? 'pending',
    })
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'activity.created', resource_type: 'crm_activity', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
