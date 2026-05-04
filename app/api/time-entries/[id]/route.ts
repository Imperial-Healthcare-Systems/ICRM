import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = ['description', 'is_billable', 'hourly_rate', 'notes', 'task_id', 'project_id', 'started_at', 'ended_at']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))

  // Recompute duration if both timestamps present
  if (updates.started_at && updates.ended_at) {
    const s = new Date(updates.started_at as string)
    const e = new Date(updates.ended_at as string)
    if (e <= s) return NextResponse.json({ error: 'ended_at must be after started_at.' }, { status: 400 })
    updates.duration_secs = Math.round((e.getTime() - s.getTime()) / 1000)
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_time_entries')
    .update(updates)
    .eq('id', id).eq('org_id', orgId).eq('user_id', userId)
    .select('id, task_id').single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })

  if (data.task_id) await supabaseAdmin.rpc('recalc_task_actual_minutes', { p_task_id: data.task_id })

  logAudit({ org_id: orgId, actor_id: userId, action: 'time.updated', resource_type: 'crm_time_entry', resource_id: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('crm_time_entries')
    .select('task_id')
    .eq('id', id).eq('org_id', orgId).eq('user_id', userId).single()

  const { error: dbErr } = await supabaseAdmin.from('crm_time_entries').delete().eq('id', id).eq('org_id', orgId).eq('user_id', userId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  if (existing?.task_id) await supabaseAdmin.rpc('recalc_task_actual_minutes', { p_task_id: existing.task_id })

  logAudit({ org_id: orgId, actor_id: userId, action: 'time.deleted', resource_type: 'crm_time_entry', resource_id: id })
  return NextResponse.json({ success: true })
}
