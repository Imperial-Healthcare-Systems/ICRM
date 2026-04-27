import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Validate token
  const { data: portalToken } = await supabaseAdmin
    .from('crm_portal_tokens')
    .select('id, org_id, account_id, expires_at, is_active')
    .eq('token', token)
    .single()

  if (!portalToken || !portalToken.is_active) {
    return NextResponse.json({ error: 'Portal link is invalid or has been revoked.' }, { status: 404 })
  }

  if (new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Portal link has expired.' }, { status: 410 })
  }

  const { org_id, account_id } = portalToken

  // Touch last_used_at
  await supabaseAdmin
    .from('crm_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', portalToken.id)

  const [accountRes, invoicesRes, quotationsRes, contractsRes, ticketsRes, orgRes] = await Promise.all([
    supabaseAdmin.from('crm_accounts')
      .select('id, name, website, industry, phone, email')
      .eq('id', account_id).single(),
    supabaseAdmin.from('crm_invoices')
      .select('id, invoice_number, status, total, currency, due_date, issue_date, paid_amount')
      .eq('org_id', org_id).eq('account_id', account_id)
      .order('issue_date', { ascending: false }).limit(20),
    supabaseAdmin.from('crm_quotations')
      .select('id, quote_number, status, total, currency, valid_until, created_at')
      .eq('org_id', org_id).eq('account_id', account_id)
      .order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('crm_contracts')
      .select('id, contract_number, title, status, start_date, end_date, value, currency')
      .eq('org_id', org_id).eq('account_id', account_id)
      .order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('crm_tickets')
      .select('id, ticket_number, title, status, priority, created_at, updated_at')
      .eq('org_id', org_id).eq('account_id', account_id)
      .order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('organisations')
      .select('name, logo_url, website, billing_email, phone')
      .eq('id', org_id).single(),
  ])

  return NextResponse.json({
    account: accountRes.data,
    invoices: invoicesRes.data ?? [],
    quotations: quotationsRes.data ?? [],
    contracts: contractsRes.data ?? [],
    tickets: ticketsRes.data ?? [],
    vendor: orgRes.data,
    expiresAt: portalToken.expires_at,
  })
}
