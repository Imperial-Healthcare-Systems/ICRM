import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const allowed = ['name', 'color', 'probability', 'position', 'is_won', 'is_lost']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_pipeline_stages')
    .update(updates)
    .eq('id', id).eq('org_id', orgId)
    .select('id, name, color, position, probability, is_won, is_lost')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Stage not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params

  // Block deletion if deals exist in this stage
  const { count } = await supabaseAdmin
    .from('crm_deals')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', id).eq('org_id', orgId)

  if (count && count > 0) {
    return NextResponse.json({ error: `Cannot delete — ${count} deal(s) are in this stage. Move them first.` }, { status: 409 })
  }

  const { error: dbError } = await supabaseAdmin
    .from('crm_pipeline_stages')
    .delete().eq('id', id).eq('org_id', orgId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
