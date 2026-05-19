/**
 * Cashfree webhook receiver — IMPERIAL_TENANT_SPEC v1.0 §7.4.
 *
 * Three flows multiplexed on cf_order_id:
 *   1. Credit top-up — order id matches `crm_payment_orders.cf_order_id`.
 *      Credits the org via the existing `add_org_credits` RPC.
 *   2. Platform subscription — order id matches `platform_invoices.cashfree_order_id`.
 *      Marks the invoice paid (read by Admin Console refund / revenue / GST flows).
 *   3. Refund finalisation — `REFUND_STATUS_WEBHOOK` carries a refund_id we
 *      previously stored on `refund_approvals.cashfree_refund_id`. We
 *      reconcile the approval row + adjust the invoice status if the
 *      refund ultimately failed.
 *
 * Signature verification gates the whole route — anything that fails it
 * gets 401 and nothing is mutated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhookSignature } from '@/lib/cashfree'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature') ?? ''
  const timestamp = req.headers.get('x-webhook-timestamp') ?? ''

  let valid = false
  try {
    valid = verifyWebhookSignature(rawBody, timestamp, signature)
  } catch {
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 401 })
  }
  if (!valid) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const eventType = event.type as string
  const data = (event.data ?? {}) as Record<string, unknown>

  // ── 1. Refund status — independent of order payment flow ────────────────
  if (eventType === 'REFUND_STATUS_WEBHOOK' || eventType === 'REFUND_SUCCESS' || eventType === 'REFUND_FAILED') {
    return handleRefundStatus(data, eventType)
  }

  // ── 2. Payment success / failure — keyed by order id ────────────────────
  if (eventType !== 'PAYMENT_SUCCESS_WEBHOOK' && eventType !== 'PAYMENT_FAILED_WEBHOOK') {
    return NextResponse.json({ received: true, ignored: eventType })
  }

  const order = (data?.order ?? {}) as Record<string, unknown>
  const payment = (data?.payment ?? {}) as Record<string, unknown>
  const cfOrderId = order?.order_id as string | undefined
  if (!cfOrderId) return NextResponse.json({ error: 'Missing order_id.' }, { status: 400 })

  if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
    // Don't flip platform_invoices.status — the invoice remains 'open' so
    // the customer can retry. Just acknowledge.
    return NextResponse.json({ received: true })
  }

  // PAYMENT_SUCCESS_WEBHOOK — route by which table owns this order.
  const { data: pendingTopUp } = await supabaseAdmin
    .from('crm_payment_orders')
    .select('id, org_id, user_id, credits, status')
    .eq('cf_order_id', cfOrderId)
    .maybeSingle()

  if (pendingTopUp) {
    if (pendingTopUp.status === 'paid') return NextResponse.json({ received: true, idempotent: true })

    await supabaseAdmin.rpc('add_org_credits', {
      p_org_id: pendingTopUp.org_id,
      p_amount: pendingTopUp.credits,
      p_user_id: pendingTopUp.user_id,
      p_ref_id: cfOrderId,
      p_description: `Credit top-up via Cashfree (${pendingTopUp.credits} credits)`,
    })

    await supabaseAdmin
      .from('crm_payment_orders')
      .update({
        status: 'paid',
        payment_ref: payment?.cf_payment_id as string ?? null,
        cf_payment_id: payment?.cf_payment_id as string ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('cf_order_id', cfOrderId)

    return NextResponse.json({ received: true, kind: 'credit_topup' })
  }

  // Not a top-up — check if it's a platform subscription invoice.
  const { data: invoice } = await supabaseAdmin
    .from('platform_invoices')
    .select('id, status')
    .eq('cashfree_order_id', cfOrderId)
    .maybeSingle()

  if (invoice) {
    if (invoice.status === 'paid') return NextResponse.json({ received: true, idempotent: true })

    await supabaseAdmin
      .from('platform_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    return NextResponse.json({ received: true, kind: 'platform_invoice' })
  }

  return NextResponse.json({ received: true, kind: 'unknown_order' }, { status: 200 })
}

/**
 * Cashfree refund webhook reconciles async refund state. Our refund flow
 * marks `platform_invoices.status='refunded'` synchronously on the accept
 * response (which is reliable), but if Cashfree later fails the refund we
 * need to revert. We also stamp the refund_approvals row.
 */
async function handleRefundStatus(
  data: Record<string, unknown>,
  eventType: string,
): Promise<NextResponse> {
  const refund = (data?.refund ?? {}) as Record<string, unknown>
  const refundId = (refund?.refund_id as string | undefined) ?? (refund?.cf_refund_id as string | undefined)
  const refundStatus = (refund?.refund_status as string | undefined) ?? eventType
  const orderId = refund?.order_id as string | undefined

  if (!refundId) return NextResponse.json({ received: true, missing: 'refund_id' })

  // Stamp the approval row if we have one matching this refund id.
  const { data: approval } = await supabaseAdmin
    .from('refund_approvals')
    .select('id, invoice_id, amount_inr, status')
    .eq('cashfree_refund_id', refundId)
    .maybeSingle()

  const succeeded = refundStatus === 'SUCCESS' || refundStatus === 'REFUND_SUCCESS' || refundStatus === 'COMPLETED'
  const failed = refundStatus === 'FAILED' || refundStatus === 'REFUND_FAILED' || refundStatus === 'CANCELLED'

  if (approval && succeeded && approval.status !== 'executed') {
    await supabaseAdmin
      .from('refund_approvals')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', approval.id)
  }

  if (approval && failed) {
    // Revert the approval and the invoice — the money never moved.
    await supabaseAdmin
      .from('refund_approvals')
      .update({ status: 'rejected', rejection_reason: `Cashfree refund failed: ${refundStatus}` })
      .eq('id', approval.id)

    if (approval.invoice_id) {
      // The synchronous accept-response set status=refunded/partially_refunded.
      // Roll back to paid since the refund didn't actually complete.
      await supabaseAdmin
        .from('platform_invoices')
        .update({ status: 'paid' })
        .eq('id', approval.invoice_id)
    }
  }

  // If no approval row matched, the refund was created without queueing
  // (small refund path) — try to reconcile by order_id.
  if (!approval && orderId && failed) {
    const { data: inv } = await supabaseAdmin
      .from('platform_invoices')
      .select('id, status')
      .eq('cashfree_order_id', orderId)
      .maybeSingle()
    if (inv && (inv.status === 'refunded' || inv.status === 'partially_refunded')) {
      await supabaseAdmin
        .from('platform_invoices')
        .update({ status: 'paid' })
        .eq('id', inv.id)
    }
  }

  return NextResponse.json({
    received: true,
    kind: 'refund_status',
    status: refundStatus,
    matched_approval: !!approval,
  })
}
