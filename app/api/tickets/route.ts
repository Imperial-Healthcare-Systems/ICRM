import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'))
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const from = (page - 1) * pageSize

  let q = supabaseAdmin
    .from('crm_tickets')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name), crm_users!assigned_to(full_name)`, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) q = q.eq('status', status)
  if (priority) q = q.eq('priority', priority)

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
  const { title, description, status = 'open', priority = 'medium', type = 'general',
    account_id, contact_id, assigned_to, sla_due_at } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data: numData, error: numErr } = await supabaseAdmin.rpc('next_doc_number', {
    p_org_id: orgId, p_type: 'ticket'
  })
  if (numErr) return NextResponse.json({ error: numErr.message }, { status: 500 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_tickets').insert({
    org_id: orgId,
    ticket_number: numData,
    title: title.trim(), description, status, priority, type,
    account_id: account_id || null, contact_id: contact_id || null,
    assigned_to: assigned_to || null, sla_due_at: sla_due_at || null,
    created_by: userId,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'ticket', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
