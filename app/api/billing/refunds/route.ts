import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { data, error: dbError } = await supabase
    .from('refund_approvals')
    .select(`
      id, invoice_id, amount_inr, reason, status,
      requested_by, requested_at,
      approved_by, approved_at,
      rejected_by, rejected_at, rejection_reason,
      executed_at, cashfree_refund_id,
      crm_invoices!invoice_id(invoice_number, total, currency, status)
    `)
    .order('requested_at', { ascending: false })
    .limit(100)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId, id: actorId, role } = session.user

  if (!['super_admin', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Only admins can request refunds.' }, { status: 403 })
  }

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { invoice_id, amount_inr, reason } = body

  if (!invoice_id) return NextResponse.json({ error: 'invoice_id is required.' }, { status: 400 })

  const amount = Number(amount_inr)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount_inr must be a positive number.' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'reason is required.' }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('crm_invoices')
    .select('id, invoice_number, status, paid_amount, total, currency')
    .eq('id', invoice_id)
    .eq('org_id', orgId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  if (!['paid', 'partially_paid'].includes(invoice.status)) {
    return NextResponse.json({ error: 'Only paid invoices can be refunded.' }, { status: 400 })
  }

  const { data: existingRefunds } = await supabaseAdmin
    .from('refund_approvals')
    .select('amount_inr, status')
    .eq('invoice_id', invoice_id)
    .in('status', ['approved', 'executed', 'pending'])

  const reservedAmount = (existingRefunds ?? []).reduce((sum, r) => sum + Number(r.amount_inr), 0)
  const paid = Number(invoice.paid_amount ?? 0)
  const maxRefundable = paid - reservedAmount

  if (amount > maxRefundable + 0.01) {
    return NextResponse.json(
      {
        error: `Refund amount exceeds refundable balance. Max refundable: ${maxRefundable.toFixed(2)} (paid ${paid.toFixed(2)}, already requested/refunded ${reservedAmount.toFixed(2)}).`,
        max_refundable: maxRefundable,
        paid_amount: paid,
        already_requested_or_refunded: reservedAmount,
      },
      { status: 400 },
    )
  }

  const { data: refund, error: insertError } = await supabaseAdmin
    .from('refund_approvals')
    .insert({
      invoice_id,
      amount_inr: amount,
      reason: reason.trim(),
      status: 'pending',
      requested_by: actorId,
    })
    .select('id, status, requested_at')
    .single()

  if (insertError || !refund) {
    console.error('[refunds] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to submit refund request.' }, { status: 500 })
  }

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'refund.requested',
    resource_type: 'refund_approval',
    resource_id: refund.id,
    meta: {
      invoice_id,
      invoice_number: invoice.invoice_number,
      amount_inr: amount,
      reason: reason.trim(),
    },
  })

  return NextResponse.json(
    {
      data: {
        id: refund.id,
        status: refund.status,
        requested_at: refund.requested_at,
        invoice_number: invoice.invoice_number,
        amount_inr: amount,
        message: 'Refund request submitted. An Imperial admin will review and respond within 3 business days.',
      },
    },
    { status: 201 },
  )
}
