import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id: invoiceId, paymentId } = await params

  const { data: payment } = await supabase
    .from('crm_invoice_payments')
    .select('id, amount')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })

  const { error: delErr } = await supabase
    .from('crm_invoice_payments')
    .delete()
    .eq('id', paymentId)
    .eq('org_id', orgId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const { data: remaining } = await supabase
    .from('crm_invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
  const newPaid = (remaining ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  const { data: inv } = await supabase
    .from('crm_invoices')
    .select('total, status, due_date')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  const total = Number(inv?.total ?? 0)
  const today = new Date().toISOString().split('T')[0]
  const updates: Record<string, unknown> = {
    paid_amount: newPaid,
    updated_at: new Date().toISOString(),
  }
  if (inv && !['cancelled', 'void'].includes(inv.status)) {
    if (newPaid >= total - 0.01) {
      updates.status = 'paid'
    } else if (newPaid > 0) {
      updates.status = 'partially_paid'
      updates.paid_date = null
    } else {
      updates.status = inv.due_date && inv.due_date < today ? 'overdue' : 'sent'
      updates.paid_date = null
    }
  }
  await supabase.from('crm_invoices').update(updates).eq('id', invoiceId).eq('org_id', orgId)

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'invoice.payment_reversed',
    resource_type: 'crm_invoice',
    resource_id: invoiceId,
    meta: { payment_id: paymentId, amount_reversed: Number(payment.amount), new_paid_total: newPaid },
  })

  return NextResponse.json({ success: true, paid_amount: newPaid })
}
