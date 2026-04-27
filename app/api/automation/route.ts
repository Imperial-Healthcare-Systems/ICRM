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

  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_automation_rules')
    .select(`*, crm_users!created_by(full_name)`)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { name, description, trigger_event, trigger_conditions = {}, action_type, action_config = {} } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!trigger_event) return NextResponse.json({ error: 'Trigger event is required' }, { status: 400 })
  if (!action_type) return NextResponse.json({ error: 'Action type is required' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_automation_rules').insert({
    org_id: orgId,
    name: name.trim(), description, trigger_event,
    trigger_conditions, action_type, action_config,
    is_active: true, created_by: userId,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'automation_rule', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
