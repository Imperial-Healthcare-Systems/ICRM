import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhookSignature } from '@/lib/cashfree'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature') ?? ''
  const timestamp = req.headers.get('x-webhook-timestamp') ?? ''

  // Verify Cashfree signature
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
  const data = event.data as Record<string, unknown>

  if (eventType !== 'PAYMENT_SUCCESS_WEBHOOK') {
    // Acknowledge but take no action for other events
    return NextResponse.json({ received: true })
  }

  const order = data?.order as Record<string, unknown>
  const payment = data?.payment as Record<string, unknown>
  const cfOrderId = order?.order_id as string

  if (!cfOrderId) return NextResponse.json({ error: 'Missing order_id.' }, { status: 400 })

  // Fetch the pending order from our DB
  const { data: pendingOrder } = await supabaseAdmin
    .from('crm_payment_orders')
    .select('id, org_id, user_id, credits, status')
    .eq('cf_order_id', cfOrderId)
    .single()

  if (!pendingOrder) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  // Idempotency — already processed
  if (pendingOrder.status === 'paid') return NextResponse.json({ received: true })

  // Credit the organisation
  await supabaseAdmin.rpc('add_org_credits', {
    p_org_id: pendingOrder.org_id,
    p_amount: pendingOrder.credits,
    p_user_id: pendingOrder.user_id,
    p_ref_id: cfOrderId,
    p_description: `Credit top-up via Cashfree (${pendingOrder.credits} credits)`,
  })

  // Update order status
  await supabaseAdmin
    .from('crm_payment_orders')
    .update({
      status: 'paid',
      payment_ref: payment?.cf_payment_id as string ?? null,
      cf_payment_id: payment?.cf_payment_id as string ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('cf_order_id', cfOrderId)

  return NextResponse.json({ received: true })
}
