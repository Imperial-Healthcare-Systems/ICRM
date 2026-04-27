import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'

/** Convert an accepted quotation to an invoice */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { data: quote } = await supabaseAdmin
    .from('crm_quotations')
    .select('*')
    .eq('id', id).eq('org_id', orgId).single()

  if (!quote) return NextResponse.json({ error: 'Quotation not found.' }, { status: 404 })
  if (!['accepted', 'draft', 'sent'].includes(quote.status)) {
    return NextResponse.json({ error: 'Only accepted/sent quotations can be converted.' }, { status: 400 })
  }

  const { data: invNum } = await supabaseAdmin
    .rpc('next_doc_number', { p_org_id: orgId, p_type: 'invoice', p_prefix: 'INV' })

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: invoice, error: invError } = await supabaseAdmin
    .from('crm_invoices')
    .insert({
      org_id: orgId,
      invoice_number: invNum ?? `INV-${Date.now()}`,
      quotation_id: quote.id,
      account_id: quote.account_id,
      contact_id: quote.contact_id,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      items: quote.items,
      subtotal: quote.subtotal,
      discount_pct: quote.discount_pct,
      tax_pct: quote.tax_pct,
      total: quote.total,
      currency: quote.currency,
      notes: quote.notes,
      terms: quote.terms,
      created_by: actorId,
    })
    .select('id, invoice_number')
    .single()

  if (invError || !invoice) return NextResponse.json({ error: 'Failed to create invoice.' }, { status: 500 })

  // Mark quotation as accepted
  await supabaseAdmin
    .from('crm_quotations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)

  logAudit({ org_id: orgId, actor_id: actorId, action: 'quotation.converted', resource_type: 'crm_quotation', resource_id: id, meta: { invoice_id: invoice.id } })
  return NextResponse.json({ data: invoice }, { status: 201 })
}
