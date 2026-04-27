import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { createPaymentSession } from '@/lib/cashfree'

export const CREDIT_PACKAGES = [
  { id: 'starter',      credits: 50,  amountInr: 499,  label: 'Starter' },
  { id: 'growth',       credits: 150, amountInr: 1299, label: 'Growth' },
  { id: 'professional', credits: 500, amountInr: 3999, label: 'Professional' },
] as const

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package.' }, { status: 400 })

  // Fetch user details for Cashfree
  const { data: user } = await supabaseAdmin
    .from('crm_users')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const cfOrderId = `ICRM-${orgId.slice(0, 8)}-${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'

  const cfOrder = await createPaymentSession({
    orderId: cfOrderId,
    orderAmount: pkg.amountInr,
    customerEmail: user.email,
    customerPhone: '9999999999', // Cashfree requires a phone; use org admin phone if available
    customerName: user.full_name,
    returnUrl: `${appUrl}/billing?status={order_status}&order_id=${cfOrderId}`,
    notifyUrl: `${appUrl}/api/webhooks/cashfree`,
    orderNote: `Imperial CRM — ${pkg.label} credit pack (${pkg.credits} credits)`,
  })

  if (!cfOrder?.payment_session_id) {
    return NextResponse.json({ error: 'Failed to create payment session.' }, { status: 500 })
  }

  // Persist the order so webhook can reference it
  await supabaseAdmin.from('crm_payment_orders').insert({
    org_id: orgId,
    user_id: userId,
    cf_order_id: cfOrderId,
    credits: pkg.credits,
    amount_inr: pkg.amountInr,
    package_id: pkg.id,
    status: 'created',
  })

  return NextResponse.json({
    paymentSessionId: cfOrder.payment_session_id,
    cfOrderId,
    amount: pkg.amountInr,
    credits: pkg.credits,
  })
}
