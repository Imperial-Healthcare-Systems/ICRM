import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'
import {
  toDecimal, toCurrencyString,
  determineGstSplit, formatPlaceOfSupply, stateCodeFromGstin,
} from '@/lib/money'

export async function GET(req: NextRequest) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabase
    .from('crm_invoices')
    .select(`
      id, invoice_number, status, issue_date, due_date, paid_date,
      total, paid_amount, currency, created_at,
      crm_accounts!account_id(name),
      crm_contacts!contact_id(first_name, last_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
}

export async function POST(req: NextRequest) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const { data: invNum } = await supabase
    .rpc('next_doc_number', { p_org_id: orgId, p_type: 'invoice', p_prefix: 'INV' })

  // ── Snapshot the buyer block from crm_accounts at issue time ──────
  // Live-joining via account_id later would let an account edit
  // retroactively rewrite this invoice. Tax invoices are legal records;
  // freeze the buyer details now.
  let buyerSnapshot: {
    buyer_name: string | null
    buyer_gstin: string | null
    buyer_address: Record<string, unknown> | null
    buyer_state: string | null
    buyer_state_code: string | null
  } = {
    buyer_name: null, buyer_gstin: null, buyer_address: null,
    buyer_state: null, buyer_state_code: null,
  }
  if (body.account_id) {
    const { data: acct } = await supabase
      .from('crm_accounts')
      .select(`
        name, gstin,
        billing_address_line1, billing_address_line2,
        billing_city, billing_state, billing_state_code,
        billing_pincode, billing_country
      `)
      .eq('id', body.account_id)
      .eq('org_id', orgId)
      .maybeSingle() as { data: {
        name: string; gstin: string | null;
        billing_address_line1: string | null; billing_address_line2: string | null;
        billing_city: string | null; billing_state: string | null;
        billing_state_code: string | null; billing_pincode: string | null;
        billing_country: string | null;
      } | null }

    if (acct) {
      buyerSnapshot = {
        buyer_name:       acct.name,
        buyer_gstin:      acct.gstin,
        buyer_state:      acct.billing_state,
        buyer_state_code: acct.billing_state_code,
        buyer_address: {
          line1:   acct.billing_address_line1,
          line2:   acct.billing_address_line2,
          city:    acct.billing_city,
          state:   acct.billing_state,
          pincode: acct.billing_pincode,
          country: acct.billing_country,
        },
      }
    }
  }

  // ── Seller state_code: prefer the organisations row, fall back to
  //    deriving from the seller's GSTIN.
  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('state, state_code, gstin')
    .eq('id', orgId)
    .maybeSingle() as { data: { state: string | null; state_code: string | null; gstin: string | null } | null }

  const sellerStateCode = org?.state_code ?? stateCodeFromGstin(org?.gstin) ?? null
  // Place of supply = buyer's state (default to seller state for B2C).
  const posCode = buyerSnapshot.buyer_state_code ?? sellerStateCode
  const place_of_supply = formatPlaceOfSupply(posCode)

  // ── Compute the tax split. Use the body's items/subtotal/tax_pct as
  //    the source of truth (the form has already done line-item math).
  const subtotalD = toDecimal(body.subtotal ?? 0)
  const taxPctD = toDecimal(body.tax_pct ?? 0)
  const split = determineGstSplit(sellerStateCode, buyerSnapshot.buyer_state_code, subtotalD, taxPctD)
  const totalD = subtotalD.plus(split.totalTax)

  const insertRow = {
    ...body,
    org_id: orgId,
    invoice_number: invNum ?? `INV-${Date.now()}`,
    created_by: actorId,
    status: body.status ?? 'draft',
    paid_amount: 0,
    // Snapshot buyer block
    ...buyerSnapshot,
    // Snapshot seller + place of supply
    seller_state_code: sellerStateCode,
    place_of_supply,
    // Tax split (stored as 2dp strings → Postgres NUMERIC)
    subtotal:    toCurrencyString(subtotalD),
    total:       toCurrencyString(totalD),
    cgst_amount: toCurrencyString(split.cgst),
    sgst_amount: toCurrencyString(split.sgst),
    igst_amount: toCurrencyString(split.igst),
  }

  const { data, error: dbError } = await supabase
    .from('crm_invoices')
    .insert(insertRow)
    .select('id, invoice_number')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({
    org_id: orgId, actor_id: actorId,
    action: 'invoice.created',
    resource_type: 'crm_invoice', resource_id: data.id,
    meta: {
      tax_kind: split.kind,
      buyer_gstin: buyerSnapshot.buyer_gstin,
      place_of_supply,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}
