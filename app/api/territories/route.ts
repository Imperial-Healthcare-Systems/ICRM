import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { data } = await supabase
    .from('crm_territories')
    .select(`*, manager:crm_users!manager_id(id, full_name)`)
    .eq('org_id', orgId)
    .order('name')
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId, role } = session.user
  if (!['super_admin', 'admin'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('crm_territories').insert({
    org_id: orgId,
    name: body.name.trim(),
    description: body.description ?? null,
    parent_id: body.parent_id || null,
    regions: Array.isArray(body.regions) ? body.regions : [],
    manager_id: body.manager_id || null,
    member_ids: Array.isArray(body.member_ids) ? body.member_ids : [],
    is_active: body.is_active ?? true,
    created_by: actorId,
  }).select('id, name').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed.' }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'territory.created', resource_type: 'crm_territory', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
