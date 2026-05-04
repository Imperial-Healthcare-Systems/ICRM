import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'

/* GET: returns the user's currently running timer (if any) */
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const { data } = await supabaseAdmin
    .from('crm_time_entries')
    .select(`
      id, started_at, description, project_id, task_id,
      crm_projects!project_id(id, name),
      crm_tasks!task_id(id, title)
    `)
    .eq('org_id', orgId).eq('user_id', userId).is('ended_at', null)
    .maybeSingle()

  return NextResponse.json({ data: data ?? null })
}

/* POST: start a timer ({ task_id?, project_id?, description? }) */
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))

  // Stop any existing timer first (DB index guarantees only one active per user)
  const { data: existing } = await supabaseAdmin
    .from('crm_time_entries')
    .select('id, started_at, task_id')
    .eq('user_id', userId).is('ended_at', null).maybeSingle()

  if (existing) {
    const now = new Date()
    const dur = Math.round((now.getTime() - new Date(existing.started_at).getTime()) / 1000)
    await supabaseAdmin.from('crm_time_entries')
      .update({ ended_at: now.toISOString(), duration_secs: dur })
      .eq('id', existing.id)
    if (existing.task_id) await supabaseAdmin.rpc('recalc_task_actual_minutes', { p_task_id: existing.task_id })
  }

  const { data, error: dbErr } = await supabaseAdmin.from('crm_time_entries').insert({
    org_id: orgId,
    user_id: userId,
    task_id: body.task_id || null,
    project_id: body.project_id || null,
    description: body.description ?? null,
    started_at: new Date().toISOString(),
    is_billable: body.is_billable ?? true,
  }).select('id, started_at').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to start timer.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

/* DELETE: stop the running timer */
export async function DELETE() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const { data: existing } = await supabaseAdmin
    .from('crm_time_entries')
    .select('id, started_at, task_id')
    .eq('org_id', orgId).eq('user_id', userId).is('ended_at', null).maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No timer running.' }, { status: 404 })

  const now = new Date()
  const dur = Math.round((now.getTime() - new Date(existing.started_at).getTime()) / 1000)
  await supabaseAdmin.from('crm_time_entries')
    .update({ ended_at: now.toISOString(), duration_secs: dur })
    .eq('id', existing.id)

  if (existing.task_id) await supabaseAdmin.rpc('recalc_task_actual_minutes', { p_task_id: existing.task_id })

  return NextResponse.json({ data: { id: existing.id, duration_secs: dur } })
}
