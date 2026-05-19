import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function GET() {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error

  const { orgId } = session.user

  const { data, error: dbError } = await supabase
    .from('crm_pipeline_stages')
    .select('id, name, color, position, probability, is_won, is_lost')
    .eq('org_id', orgId)
    .order('position', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })

  const { data: last } = await supabase
    .from('crm_pipeline_stages')
    .select('position')
    .eq('org_id', orgId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const { data, error: dbError } = await supabase
    .from('crm_pipeline_stages')
    .insert({
      org_id: orgId,
      name: body.name,
      color: body.color ?? '#6B7280',
      probability: body.probability ?? 0,
      is_won: body.is_won ?? false,
      is_lost: body.is_lost ?? false,
      position: (last?.position ?? 0) + 1,
    })
    .select('id, name, color, position, probability, is_won, is_lost')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
