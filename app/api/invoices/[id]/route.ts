import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { sendInvoiceEmail } from '@/lib/mailer'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_invoices')
    .select(`*, crm_accounts!account_id(id,name,email), crm_contacts!contact_id(id,first_name,last_name,email)`)
    .eq('id', id).eq('org_id', orgId).single()

  if (dbError || !data) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params
  const body = await req.json()

  const ALLOWED = ['quotation_id', 'account_id', 'contact_id', 'status', 'issue_date', 'due_date', 'paid_date', 'items', 'subtotal', 'discount_pct', 'tax_pct', 'total', 'paid_amount', 'currency', 'notes', 'terms']
  const updates: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  updates.updated_at = new Date().toISOString()
  if (body.status === 'paid' && !body.paid_date) {
    updates.paid_date = new Date().toISOString().split('T')[0]
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_invoices')
    .update(updates)
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  // Send invoice email when status changes to 'sent'
  if (body.status === 'sent') {
    const { data: inv } = await supabaseAdmin
      .from('crm_invoices')
      .select(`invoice_number, total, due_date, currency, crm_accounts!account_id(name, email), crm_contacts!contact_id(first_name, last_name, email)`)
      .eq('id', id).single()

    if (inv) {
      const contact = inv.crm_contacts as any
      const account = inv.crm_accounts as any
      const toEmail = contact?.email ?? account?.email
      const toName = contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : account?.name ?? 'Valued Customer'

      if (toEmail) {
        sendInvoiceEmail({
          to: toEmail, name: toName,
          orgName: account?.name ?? '',
          invoiceNumber: inv.invoice_number,
          amount: new Intl.NumberFormat('en-IN', { style: 'currency', currency: inv.currency ?? 'INR' }).format(inv.total),
          period: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          dueDate: inv.due_date,
        }).catch(() => {})
      }
    }
  }

  logAudit({ org_id: orgId, actor_id: actorId, action: 'invoice.updated', resource_type: 'crm_invoice', resource_id: id, meta: { status: body.status } })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const { id } = await params

  const { error: dbError } = await supabaseAdmin.from('crm_invoices').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'invoice.deleted', resource_type: 'crm_invoice', resource_id: id })
  return NextResponse.json({ success: true })
}
