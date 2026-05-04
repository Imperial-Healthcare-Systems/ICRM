import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const CATEGORIES = ['travel', 'meals', 'accommodation', 'supplies', 'software', 'marketing', 'training', 'client_entertainment', 'general', 'other']

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId, role } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''
  const scope = url.searchParams.get('scope') ?? 'all'  // 'mine' | 'all'
  const isAdmin = ['super_admin', 'admin'].includes(role)

  let q = supabaseAdmin
    .from('crm_expenses')
    .select(`
      id, expense_number, amount, currency, expense_date, category, description, status,
      is_billable, reimbursable, created_at, submitted_at, approved_at,
      crm_users!user_id(id, full_name),
      crm_projects!project_id(id, name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('expense_date', { ascending: false })
    .limit(200)

  if (status) q = q.eq('status', status)
  // Non-admins only see their own unless scope=all is requested AND they have permission
  if (scope === 'mine' || !isAdmin) q = q.eq('user_id', userId)

  const { data, count } = await q
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  if (!body.expense_date) return NextResponse.json({ error: 'Date is required.' }, { status: 400 })
  if (body.category && !CATEGORIES.includes(body.category))
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })

  const { data: numData } = await supabaseAdmin.rpc('next_doc_number', { p_org_id: orgId, p_type: 'expense', p_prefix: 'EXP' })
  const expense_number = numData ?? `EXP-${Date.now()}`

  const status = body.submit ? 'submitted' : 'draft'

  const { data, error: dbErr } = await supabaseAdmin.from('crm_expenses').insert({
    org_id: orgId,
    expense_number,
    user_id: userId,
    project_id: body.project_id || null,
    account_id: body.account_id || null,
    category: body.category ?? 'general',
    amount,
    currency: body.currency ?? 'INR',
    expense_date: body.expense_date,
    description: body.description.trim(),
    receipt_url: body.receipt_url ?? null,
    status,
    is_billable: body.is_billable ?? false,
    reimbursable: body.reimbursable ?? true,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    notes: body.notes ?? null,
  }).select('id, expense_number, status').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to create.' }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: userId, action: status === 'submitted' ? 'expense.submitted' : 'expense.created', resource_type: 'crm_expense', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
