import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

/* ─── Reverse a payment (delete + recompute invoice) ─── */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id: invoiceId, paymentId } = await params

  // Fetch the payment to know how much to reverse
  const { data: payment } = await supabaseAdmin
    .from('crm_invoice_payments')
    .select('id, amount')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })

  // Delete the payment row
  const { error: delErr } = await supabaseAdmin
    .from('crm_invoice_payments')
    .delete()
    .eq('id', paymentId)
    .eq('org_id', orgId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Recompute paid_amount from the remaining payments (more reliable than subtraction)
  const { data: remaining } = await supabaseAdmin
    .from('crm_invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
  const newPaid = (remaining ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  // Update invoice; downgrade 'paid' → 'sent' if it's no longer fully paid
  const { data: inv } = await supabaseAdmin
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
  // Derive status from the new ledger sum
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
  await supabaseAdmin.from('crm_invoices').update(updates).eq('id', invoiceId).eq('org_id', orgId)

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
