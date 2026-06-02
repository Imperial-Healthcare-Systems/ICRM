import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { checkMutationLimit, checkReadLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error

  const { orgId } = session.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const isEstimate = searchParams.get('is_estimate')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)
  const from = (page - 1) * pageSize

  let query = supabase
    .from('crm_quotations')
    .select(`
      id, quote_number, status, valid_until, total, currency, created_at, is_estimate,
      crm_accounts!account_id(name),
      crm_contacts!contact_id(first_name, last_name),
      crm_users!created_by(full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (search) query = query.or(`quote_number.ilike.%${search}%`)
  if (isEstimate === 'true') query = query.eq('is_estimate', true)
  else if (isEstimate === 'false') query = query.or('is_estimate.is.null,is_estimate.eq.false')

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

  const isEstimate = body.is_estimate === true
  const docType = isEstimate ? 'estimate' : 'quotation'
  const docPrefix = isEstimate ? 'EST' : 'QT'

  const { data: numData } = await supabase
    .rpc('next_doc_number', { p_org_id: orgId, p_type: docType, p_prefix: docPrefix })

  // ── Snapshot buyer block from crm_accounts at issue time ──────────
  // Same legal-record rationale as invoices: a later edit to the
  // account must not retroactively rewrite this quotation.
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

  const { data, error: dbError } = await supabase
    .from('crm_quotations')
    .insert({
      ...body,
      org_id: orgId,
      quote_number: numData ?? `${docPrefix}-${Date.now()}`,
      created_by: actorId,
      status: body.status ?? 'draft',
      ...buyerSnapshot,
    })
    .select('id, quote_number')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quotation.created', resource_type: 'crm_quotation', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
