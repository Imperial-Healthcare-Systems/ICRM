import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/* Public, anonymous invoice view by share token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })

  const { data: inv } = await supabaseAdmin
    .from('crm_invoices')
    .select(`
      id, invoice_number, status, issue_date, due_date, paid_date,
      items, subtotal, tax_pct, total, paid_amount, currency, notes, terms, org_id,
      crm_accounts!account_id(name, email, phone)
    `)
    .eq('public_token', token)
    .single()

  if (!inv) return NextResponse.json({ error: 'Invoice not found or link revoked.' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('name, gstin, phone, website, address, logo_url')
    .eq('id', inv.org_id)
    .single()

  const { data: payments } = await supabaseAdmin
    .from('crm_invoice_payments')
    .select('id, amount, payment_method, reference, paid_at')
    .eq('invoice_id', inv.id)
    .order('paid_at', { ascending: false })

  return NextResponse.json({
    data: {
      invoice_number: inv.invoice_number,
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      paid_date: inv.paid_date,
      items: inv.items ?? [],
      subtotal: Number(inv.subtotal ?? 0),
      tax_pct: Number(inv.tax_pct ?? 0),
      total: Number(inv.total ?? 0),
      paid_amount: Number(inv.paid_amount ?? 0),
      currency: inv.currency ?? 'INR',
      notes: inv.notes,
      terms: inv.terms,
      account: Array.isArray(inv.crm_accounts) ? inv.crm_accounts[0] : inv.crm_accounts,
      organisation: org,
      payments: payments ?? [],
    },
  })
}
