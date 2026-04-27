import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInvoiceEmail } from '@/lib/mailer'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const PLAN_PRICES: Record<string, number> = {
  starter: 1999,
  growth: 4999,
  pro: 9999,
  enterprise: 24999,
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Find all active paid (non-trial) orgs
  const { data: orgs } = await supabaseAdmin
    .from('organisations')
    .select('id, name, billing_email, plan_tier')
    .eq('subscription_status', 'active')
    .not('plan_tier', 'is', null)

  if (!orgs?.length) return NextResponse.json({ invoiced: 0 })

  const now = new Date()
  const periodLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + 7)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  let invoiced = 0

  for (const org of orgs) {
    const amount = PLAN_PRICES[org.plan_tier]
    if (!amount) continue

    // Get admin user
    const { data: admin } = await supabaseAdmin
      .from('crm_users')
      .select('full_name, email')
      .eq('org_id', org.id)
      .eq('role', 'super_admin')
      .single()

    if (!admin) continue

    // Generate invoice number via sequence
    const { data: invoiceNum } = await supabaseAdmin.rpc('next_doc_number', {
      p_org_id: org.id,
      p_type: 'invoice',
      p_prefix: 'INV',
    })

    // Create the invoice record
    const { data: inv } = await supabaseAdmin.from('crm_invoices').insert({
      org_id: org.id,
      invoice_number: invoiceNum,
      status: 'sent',
      issue_date: now.toISOString().split('T')[0],
      due_date: dueDateStr,
      items: [{ description: `Imperial CRM ${org.plan_tier} plan — ${periodLabel}`, qty: 1, rate: amount, total: amount }],
      subtotal: amount,
      tax_pct: 18,
      total: Math.round(amount * 1.18),
      currency: 'INR',
    }).select('id, invoice_number, total').single()

    if (!inv) continue

    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

    try {
      await sendInvoiceEmail({
        to: admin.email,
        name: admin.full_name,
        orgName: org.name,
        invoiceNumber: inv.invoice_number,
        amount: fmt(inv.total),
        period: periodLabel,
        dueDate: dueDateStr,
        invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/invoices/${inv.id}`,
      })
    } catch {
      // Non-fatal
    }

    invoiced++
  }

  return NextResponse.json({ invoiced })
}
