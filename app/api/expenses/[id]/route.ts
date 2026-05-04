import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const SUBMITTER_ALLOWED = ['category', 'amount', 'currency', 'expense_date', 'description', 'receipt_url', 'is_billable', 'reimbursable', 'project_id', 'account_id', 'notes']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data } = await supabaseAdmin.from('crm_expenses')
    .select(`*, crm_users!user_id(id, full_name, email), crm_projects!project_id(id, name), crm_accounts!account_id(id, name), approver:crm_users!approved_by(id, full_name)`)
    .eq('id', id).eq('org_id', orgId).single()
  if (!data) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

/* PATCH: edits by submitter (only when draft/rejected), or status transitions by approvers */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId, role } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const isApprover = ['super_admin', 'admin'].includes(role) || role === 'manager'

  const { data: expense } = await supabaseAdmin.from('crm_expenses').select('user_id, status').eq('id', id).eq('org_id', orgId).single()
  if (!expense) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })

  // Status transition (approval flow)
  if (body.action) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.action === 'submit') {
      if (expense.user_id !== userId) return NextResponse.json({ error: 'Only the submitter can submit.' }, { status: 403 })
      if (!['draft', 'rejected'].includes(expense.status)) return NextResponse.json({ error: 'Only draft/rejected expenses can be submitted.' }, { status: 400 })
      updates.status = 'submitted'
      updates.submitted_at = new Date().toISOString()
      updates.rejection_reason = null
    } else if (body.action === 'approve') {
      if (!isApprover) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
      if (expense.status !== 'submitted') return NextResponse.json({ error: 'Only submitted expenses can be approved.' }, { status: 400 })
      updates.status = 'approved'
      updates.approved_by = userId
      updates.approved_at = new Date().toISOString()
    } else if (body.action === 'reject') {
      if (!isApprover) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
      if (expense.status !== 'submitted') return NextResponse.json({ error: 'Only submitted expenses can be rejected.' }, { status: 400 })
      updates.status = 'rejected'
      updates.rejection_reason = body.rejection_reason?.trim() || 'Rejected'
      updates.approved_by = userId
    } else if (body.action === 'reimburse') {
      if (!isApprover) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
      if (expense.status !== 'approved') return NextResponse.json({ error: 'Only approved expenses can be reimbursed.' }, { status: 400 })
      updates.status = 'reimbursed'
      updates.reimbursed_at = new Date().toISOString()
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    await supabaseAdmin.from('crm_expenses').update(updates).eq('id', id).eq('org_id', orgId)
    logAudit({ org_id: orgId, actor_id: userId, action: `expense.${body.action}d`, resource_type: 'crm_expense', resource_id: id })
    return NextResponse.json({ success: true, status: updates.status })
  }

  // Field edits — only by submitter, only on draft/rejected
  if (expense.user_id !== userId) return NextResponse.json({ error: 'Only the submitter can edit.' }, { status: 403 })
  if (!['draft', 'rejected'].includes(expense.status)) return NextResponse.json({ error: 'Cannot edit submitted/approved expenses.' }, { status: 400 })

  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => SUBMITTER_ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_expenses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: userId, action: 'expense.updated', resource_type: 'crm_expense', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const { id } = await params

  const { data: expense } = await supabaseAdmin.from('crm_expenses').select('user_id, status').eq('id', id).eq('org_id', orgId).single()
  if (!expense) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (expense.user_id !== userId) return NextResponse.json({ error: 'Only the submitter can delete.' }, { status: 403 })
  if (expense.status === 'reimbursed') return NextResponse.json({ error: 'Cannot delete a reimbursed expense.' }, { status: 400 })

  const { error: dbErr } = await supabaseAdmin.from('crm_expenses').delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: userId, action: 'expense.deleted', resource_type: 'crm_expense', resource_id: id })
  return NextResponse.json({ success: true })
}
