import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = [
  'project_id', 'title', 'description', 'status', 'priority',
  'assignee_id', 'due_date', 'estimated_minutes', 'completed_at',
  'position', 'tags',
]

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params

  const { data } = await supabaseAdmin
    .from('crm_tasks')
    .select(`
      *,
      crm_users!assignee_id(id, full_name, email),
      crm_projects!project_id(id, name)
    `)
    .eq('id', id).eq('org_id', orgId).single()

  if (!data) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  // Auto-set completed_at when status flips to 'done'
  if (updates.status === 'done' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== 'done') {
    updates.completed_at = null
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'task.updated', resource_type: 'crm_task', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbErr } = await supabaseAdmin.from('crm_tasks').delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'task.deleted', resource_type: 'crm_task', resource_id: id })
  return NextResponse.json({ success: true })
}
