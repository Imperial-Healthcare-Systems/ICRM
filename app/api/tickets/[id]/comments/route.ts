import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_ticket_comments')
    .select(`*, crm_users!created_by(full_name)`)
    .eq('ticket_id', id).eq('org_id', orgId)
    .order('created_at', { ascending: true })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const { body: commentBody, is_internal = false } = await req.json()
  if (!commentBody?.trim()) return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_ticket_comments').insert({
    org_id: orgId, ticket_id: id,
    body: commentBody.trim(), is_internal, created_by: userId,
  }).select(`*, crm_users!created_by(full_name)`).single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  await supabaseAdmin.from('crm_tickets').update({ updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)

  return NextResponse.json({ data }, { status: 201 })
}
