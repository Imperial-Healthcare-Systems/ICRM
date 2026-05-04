import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const projectId = url.searchParams.get('project_id') ?? ''
  const taskId = url.searchParams.get('task_id') ?? ''
  const scope = url.searchParams.get('scope') ?? 'all' // 'mine' | 'all'
  const from = url.searchParams.get('from')   // YYYY-MM-DD
  const to = url.searchParams.get('to')

  let q = supabaseAdmin
    .from('crm_time_entries')
    .select(`
      id, description, started_at, ended_at, duration_secs, is_billable, hourly_rate,
      approved, project_id, task_id, user_id, notes,
      crm_users!user_id(id, full_name),
      crm_projects!project_id(id, name),
      crm_tasks!task_id(id, title)
    `)
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(500)

  if (scope === 'mine') q = q.eq('user_id', userId)
  if (projectId) q = q.eq('project_id', projectId)
  if (taskId) q = q.eq('task_id', taskId)
  if (from) q = q.gte('started_at', from + 'T00:00:00Z')
  if (to) q = q.lte('started_at', to + 'T23:59:59Z')

  const { data } = await q
  return NextResponse.json({ data: data ?? [] })
}

/* Create a manual time entry (already-completed work, not a running timer). */
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const startedAt = body.started_at ? new Date(body.started_at) : null
  const endedAt = body.ended_at ? new Date(body.ended_at) : null
  if (!startedAt || !endedAt) return NextResponse.json({ error: 'started_at and ended_at are required.' }, { status: 400 })
  if (endedAt <= startedAt) return NextResponse.json({ error: 'ended_at must be after started_at.' }, { status: 400 })

  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)

  const { data, error: dbErr } = await supabaseAdmin.from('crm_time_entries').insert({
    org_id: orgId,
    user_id: userId,
    task_id: body.task_id || null,
    project_id: body.project_id || null,
    description: body.description ?? null,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_secs: duration,
    is_billable: body.is_billable ?? true,
    hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : null,
    notes: body.notes ?? null,
  }).select('id, duration_secs, task_id').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to log time.' }, { status: 500 })

  if (data.task_id) await supabaseAdmin.rpc('recalc_task_actual_minutes', { p_task_id: data.task_id })

  logAudit({ org_id: orgId, actor_id: userId, action: 'time.logged', resource_type: 'crm_time_entry', resource_id: data.id, meta: { duration_secs: duration } })
  return NextResponse.json({ data }, { status: 201 })
}
