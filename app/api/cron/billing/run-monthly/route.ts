/**
 * Monthly subscription billing cron — IMPERIAL_TENANT_SPEC v1.0 §7.3.
 * Vercel Cron schedule: 03:00 IST every day (so subs whose next_billing_date
 * falls on any calendar day get invoiced on time).
 *
 * For each active org_subscription whose next_billing_date ≤ today:
 *   1. Compute base = amount_per_month × seats; add open seat_overage_events
 *   2. Apply 18% GST → total
 *   3. Generate platform-invoice number (PLT-YYYYMM-XXXXXX)
 *   4. Create a Cashfree payment order so the customer can pay; the
 *      cashfree_order_id is persisted (required by the Admin Console refund
 *      flow which reads `platform_invoices.cashfree_order_id`).
 *   5. Insert platform_invoices row with status='open' (paid is stamped
 *      asynchronously by /api/webhooks/cashfree when payment succeeds)
 *   6. Close out the open seat_overage_events by setting `invoiced_in`
 *   7. Advance org_subscriptions.next_billing_date by one month
 *   8. Email the billing contact a pay link
 *
 * Cashfree order creation can fail (mis-configured credentials, network).
 * In that case we still create the platform_invoices row WITHOUT the
 * cashfree_order_id so the bill is on the books; the row can be retried
 * later. Bookkeeping > payment-link fidelity.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInvoiceEmail } from '@/lib/mailer'
import { createPaymentSession } from '@/lib/cashfree'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const TAX_PCT = 18

type SubRow = {
  id: string
  org_id: string
  product: string
  tier: string
  seats: number
  amount_per_month: number | string
  currency: string | null
  next_billing_date: string | null
  current_period_start: string | null
  current_period_end: string | null
  organisations: {
    name: string
    billing_email: string | null
    contact_phone: string | null
  } | { name: string; billing_email: string | null; contact_phone: string | null }[] | null
}

function pickOrg(o: SubRow['organisations']) {
  if (!o) return null
  return Array.isArray(o) ? (o[0] ?? null) : o
}

function genInvoiceNumber() {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `PLT-${ym}-${suffix}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const periodLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + 7)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const { data: subs } = await supabaseAdmin
    .from('org_subscriptions')
    .select(`
      id, org_id, product, tier, seats, amount_per_month, currency,
      next_billing_date, current_period_start, current_period_end,
      organisations!inner(name, billing_email, contact_phone)
    `)
    .eq('status', 'active')
    .lte('next_billing_date', today) as { data: SubRow[] | null }

  let invoiced = 0
  let cashfreeOrders = 0
  const skipped: Array<{ org_id: string; reason: string }> = []

  for (const sub of subs ?? []) {
    const org = pickOrg(sub.organisations)
    if (!org) {
      skipped.push({ org_id: sub.org_id, reason: 'org not found' })
      continue
    }

    const seats = Number(sub.seats ?? 1)
    const rate = Number(sub.amount_per_month ?? 0)
    if (rate <= 0) {
      skipped.push({ org_id: sub.org_id, reason: 'zero amount_per_month' })
      continue
    }

    const baseSubtotal = rate * seats

    // Fold open seat overages (events not yet stamped into any invoice).
    const { data: overages } = await supabaseAdmin
      .from('seat_overage_events')
      .select('id, amount_inr')
      .eq('subscription_id', sub.id)
      .is('invoiced_in', null)

    const overageSubtotal = (overages ?? []).reduce(
      (s, o) => s + Number((o as { amount_inr: number | string }).amount_inr ?? 0),
      0,
    )
    const subtotal = Number((baseSubtotal + overageSubtotal).toFixed(2))
    const tax = Number((subtotal * (TAX_PCT / 100)).toFixed(2))
    const total = Number((subtotal + tax).toFixed(2))

    // Period bounds — start from prior period_end (if any), else today.
    const periodStartStr = sub.current_period_end ?? sub.next_billing_date ?? today
    const periodEnd = new Date(periodStartStr); periodEnd.setMonth(periodEnd.getMonth() + 1)
    const periodEndStr = periodEnd.toISOString().split('T')[0]

    const invoiceNumber = genInvoiceNumber()

    // Try to create a Cashfree payment order. If credentials are missing or
    // Cashfree errors, fall back to inserting the invoice without an order
    // id — the bill is still on the books and can be linked later.
    let cashfreeOrderId: string | null = null
    if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
      try {
        const cfRes = await createPaymentSession({
          orderId: invoiceNumber,
          orderAmount: total,
          customerEmail: org.billing_email ?? 'billing@imperialcrm.cloud',
          customerPhone: org.contact_phone ?? '0000000000',
          customerName: org.name,
          returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/billing/return?invoice=${invoiceNumber}`,
          notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/api/webhooks/cashfree`,
          orderNote: `Imperial ${sub.product.toUpperCase()} ${sub.tier} — ${periodLabel}`,
        })
        cashfreeOrderId = (cfRes as { order_id?: string })?.order_id ?? invoiceNumber
        cashfreeOrders++
      } catch (e) {
        console.warn(`[cron/run-monthly] Cashfree order failed for ${sub.org_id}:`, e)
      }
    }

    const { data: inv, error: invErr } = await supabaseAdmin.from('platform_invoices').insert({
      org_id: sub.org_id,
      subscription_id: sub.id,
      invoice_number: invoiceNumber,
      product: sub.product,
      period_start: periodStartStr,
      period_end: periodEndStr,
      subtotal,
      tax,
      total,
      currency: sub.currency ?? 'INR',
      status: 'open',
      cashfree_order_id: cashfreeOrderId,
    }).select('id, invoice_number, total').single()

    if (invErr || !inv) {
      skipped.push({ org_id: sub.org_id, reason: invErr?.message ?? 'platform_invoice insert failed' })
      continue
    }

    // Close out the overages by stamping them with the new invoice id.
    if ((overages ?? []).length > 0) {
      await supabaseAdmin
        .from('seat_overage_events')
        .update({ invoiced_in: inv.id })
        .eq('subscription_id', sub.id)
        .is('invoiced_in', null)
    }

    // Advance the subscription's billing cycle. next_billing_date is the
    // day the cron should consider this sub eligible again.
    await supabaseAdmin.from('org_subscriptions').update({
      current_period_start: periodStartStr,
      current_period_end: periodEndStr,
      next_billing_date: periodEndStr,
      updated_at: now.toISOString(),
    }).eq('id', sub.id)

    // Notify the billing contact. Prefer the org's super_admin if one exists.
    const { data: admin } = await supabaseAdmin
      .from('crm_users')
      .select('full_name, email')
      .eq('org_id', sub.org_id)
      .eq('role', 'super_admin')
      .maybeSingle()

    const toEmail = admin?.email ?? org.billing_email
    if (toEmail) {
      const fmt = (n: number) => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: sub.currency ?? 'INR', maximumFractionDigits: 0,
      }).format(n)

      try {
        await sendInvoiceEmail({
          to: toEmail,
          name: admin?.full_name ?? 'Administrator',
          orgName: org.name,
          invoiceNumber: inv.invoice_number ?? invoiceNumber,
          amount: fmt(inv.total),
          period: periodLabel,
          dueDate: dueDateStr,
          invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/billing/pay?invoice=${invoiceNumber}`,
        })
      } catch {
        // Non-fatal — the invoice is recorded; email retry is operator's job.
      }
    }

    invoiced++
  }

  return NextResponse.json({
    invoiced,
    cashfree_orders_created: cashfreeOrders,
    skipped: skipped.length,
    skipDetail: skipped.slice(0, 20),
  })
}
