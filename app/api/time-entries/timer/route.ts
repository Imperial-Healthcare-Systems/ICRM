import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function GET() {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId, id: userId } = session.user

  const { data } = await supabase
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

export async function POST(req: NextRequest) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: userId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))

  const { data: existing } = await supabase
    .from('crm_time_entries')
    .select('id, started_at, task_id')
    .eq('user_id', userId).is('ended_at', null).maybeSingle()

  if (existing) {
    const now = new Date()
    const dur = Math.round((now.getTime() - new Date(existing.started_at).getTime()) / 1000)
    await supabase.from('crm_time_entries')
      .update({ ended_at: now.toISOString(), duration_secs: dur })
      .eq('id', existing.id)
    if (existing.task_id) await supabase.rpc('recalc_task_actual_minutes', { p_task_id: existing.task_id })
  }

  const { data, error: dbErr } = await supabase.from('crm_time_entries').insert({
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

export async function DELETE() {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: userId } = session.user

  const { data: existing } = await supabase
    .from('crm_time_entries')
    .select('id, started_at, task_id')
    .eq('org_id', orgId).eq('user_id', userId).is('ended_at', null).maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No timer running.' }, { status: 404 })

  const now = new Date()
  const dur = Math.round((now.getTime() - new Date(existing.started_at).getTime()) / 1000)
  await supabase.from('crm_time_entries')
    .update({ ended_at: now.toISOString(), duration_secs: dur })
    .eq('id', existing.id)

  if (existing.task_id) await supabase.rpc('recalc_task_actual_minutes', { p_task_id: existing.task_id })

  return NextResponse.json({ data: { id: existing.id, duration_secs: dur } })
}
