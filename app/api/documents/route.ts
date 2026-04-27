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
  const category = searchParams.get('category')
  const from = (page - 1) * pageSize

  let q = supabaseAdmin
    .from('crm_documents')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name), crm_users!uploaded_by(full_name)`, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (category) q = q.eq('category', category)

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
  const { name, file_url, file_type, file_size, category = 'general',
    account_id, contact_id, deal_id } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!file_url?.trim()) return NextResponse.json({ error: 'File URL is required' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_documents').insert({
    org_id: orgId,
    name: name.trim(), file_url, file_type, file_size: file_size || null,
    category, account_id: account_id || null, contact_id: contact_id || null,
    deal_id: deal_id || null, uploaded_by: userId,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'create', resource_type: 'document', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
