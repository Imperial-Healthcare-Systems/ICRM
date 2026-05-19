import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { id } = await params

  const { data, error: dbError } = await supabase
    .from('refund_approvals')
    .select(`
      id, invoice_id, amount_inr, reason, status,
      requested_by, requested_at,
      approved_by, approved_at,
      rejected_by, rejected_at, rejection_reason,
      executed_at, cashfree_refund_id,
      crm_invoices!invoice_id(invoice_number, total, paid_amount, currency, status)
    `)
    .eq('id', id)
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Refund request not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId, id: actorId, role } = session.user
  const { id } = await params

  if (!['super_admin', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Only admins can cancel refund requests.' }, { status: 403 })
  }

  const { data: refund } = await supabase
    .from('refund_approvals')
    .select('id, status, requested_by, amount_inr, invoice_id, crm_invoices!invoice_id(invoice_number, org_id)')
    .eq('id', id)
    .single()

  if (!refund) return NextResponse.json({ error: 'Refund request not found.' }, { status: 404 })

  const invoice = Array.isArray(refund.crm_invoices) ? refund.crm_invoices[0] : refund.crm_invoices
  if (!invoice || (invoice as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: 'Refund request not found.' }, { status: 404 })
  }

  if (refund.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot cancel a ${refund.status} refund request.` },
      { status: 400 },
    )
  }

  const { error: deleteError } = await supabaseAdmin
    .from('refund_approvals')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to cancel refund request.' }, { status: 500 })
  }

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'refund.cancelled',
    resource_type: 'refund_approval',
    resource_id: id,
    meta: {
      invoice_id: refund.invoice_id,
      invoice_number: (invoice as { invoice_number: string }).invoice_number,
      amount_inr: refund.amount_inr,
    },
  })

  return NextResponse.json({ success: true })
}
