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

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'))
  const status = searchParams.get('status')
  const from = (page - 1) * pageSize

  let q = supabaseAdmin
    .from('crm_field_visits')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name), crm_users!assigned_to(full_name)`, { count: 'exact' })
    .eq('org_id', orgId)
    .order('scheduled_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) q = q.eq('status', status)

  const { data, count, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { title, account_id, contact_id, assigned_to, status = 'scheduled',
    scheduled_at, location, notes } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data: numData, error: numErr } = await supabaseAdmin.rpc('next_doc_number', {
    p_org_id: orgId, p_type: 'visit'
  })
  if (numErr) return NextResponse.json({ error: numErr.message }, { status: 500 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_field_visits').insert({
    org_id: orgId,
    visit_number: numData,
    title: title.trim(), account_id: account_id || null, contact_id: contact_id || null,
    assigned_to: assigned_to || null, status,
    scheduled_at: scheduled_at || null, location, notes,
    created_by: userId,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'field_visit', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
