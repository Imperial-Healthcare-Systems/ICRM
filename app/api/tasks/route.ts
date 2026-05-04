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
  const projectId = url.searchParams.get('project_id') ?? ''
  const assigneeId = url.searchParams.get('assignee_id') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const search = url.searchParams.get('search')?.trim() ?? ''

  let q = supabaseAdmin
    .from('crm_tasks')
    .select(`
      id, title, status, priority, due_date, estimated_minutes, actual_minutes, project_id, position, created_at,
      crm_users!assignee_id(id, full_name),
      crm_projects!project_id(id, name)
    `)
    .eq('org_id', orgId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500)

  if (projectId) q = q.eq('project_id', projectId)
  if (assigneeId) q = q.eq('assignee_id', assigneeId)
  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('title', `%${search}%`)

  const { data } = await q
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_tasks').insert({
    org_id: orgId,
    project_id: body.project_id || null,
    title: body.title.trim(),
    description: body.description ?? null,
    status: body.status ?? 'todo',
    priority: body.priority ?? 'medium',
    assignee_id: body.assignee_id || actorId,
    due_date: body.due_date || null,
    estimated_minutes: body.estimated_minutes ? Number(body.estimated_minutes) : null,
    position: body.position ?? 0,
    created_by: actorId,
  }).select('id, title').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to create task.' }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'task.created', resource_type: 'crm_task', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
