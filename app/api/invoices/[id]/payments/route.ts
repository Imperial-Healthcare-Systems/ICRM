import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import {
  toDecimal, sumDecimals, toCurrencyString, toCurrencyNumber,
  greaterThanToPaise, gteToPaise, clampedDifference,
} from '@/lib/money'
import type Decimal from 'decimal.js'

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'online', 'other']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const { data } = await supabase
    .from('crm_invoice_payments')
    .select('id, amount, currency, payment_method, reference, paid_at, notes, created_at, crm_users!created_by(full_name)')
    .eq('invoice_id', id)
    .eq('org_id', orgId)
    .order('paid_at', { ascending: false })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id: invoiceId } = await params
  const body = await req.json()

  // Precision: parse input as Decimal so we never enter the IEEE-754 trap.
  const amount = toDecimal(body.amount)
  const payment_method = (body.payment_method ?? 'bank_transfer').toString()
  const reference = body.reference?.toString().trim() || null
  const notes = body.notes?.toString().trim() || null
  const paid_at = body.paid_at ? new Date(body.paid_at).toISOString() : new Date().toISOString()
  const allowOverpay = body.allow_overpay === true

  if (!amount.isFinite() || amount.lte(0)) {
    return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 })
  }
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return NextResponse.json({ error: `Invalid payment_method. Allowed: ${PAYMENT_METHODS.join(', ')}` }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('crm_invoices')
    .select('id, total, currency, status, due_date')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  if (['cancelled', 'void'].includes(invoice.status)) {
    return NextResponse.json({ error: `Cannot record payments on a ${invoice.status} invoice.` }, { status: 400 })
  }

  const total = toDecimal(invoice.total ?? 0)

  const { data: existing } = await supabase
    .from('crm_invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
  // Precision: sum payments via Decimal — no float accumulation drift.
  const currentLedgerSum = sumDecimals((existing ?? []).map(p => p.amount))
  const projected = currentLedgerSum.plus(amount)

  // Compare at paise precision (no ±0.01 float tolerance band-aid needed).
  if (!allowOverpay && greaterThanToPaise(projected, total)) {
    const outstanding = clampedDifference(total, currentLedgerSum)
    return NextResponse.json({
      error: `Amount exceeds outstanding balance. Outstanding: ${toCurrencyString(outstanding)}`,
      outstanding: toCurrencyNumber(outstanding),
    }, { status: 400 })
  }

  const { data: payment, error: payErr } = await supabase
    .from('crm_invoice_payments')
    .insert({
      org_id: orgId,
      invoice_id: invoiceId,
      amount: toCurrencyString(amount),
      currency: invoice.currency ?? 'INR',
      payment_method,
      reference,
      notes,
      paid_at,
      created_by: actorId,
    })
    .select('id, amount, payment_method, paid_at')
    .single()

  if (payErr || !payment) return NextResponse.json({ error: payErr?.message ?? 'Failed to record payment.' }, { status: 500 })

  const projectedStr = toCurrencyString(projected)
  const newStatus = deriveStatus(projected, total, invoice.status, invoice.due_date)
  const updates: Record<string, unknown> = {
    paid_amount: projectedStr,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'paid') updates.paid_date = paid_at.split('T')[0]
  await supabase.from('crm_invoices').update(updates).eq('id', invoiceId).eq('org_id', orgId)

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'invoice.payment_recorded',
    resource_type: 'crm_invoice',
    resource_id: invoiceId,
    meta: { payment_id: payment.id, amount: toCurrencyNumber(amount), method: payment_method, new_status: newStatus, ledger_sum: toCurrencyNumber(projected) },
  })

  return NextResponse.json({
    data: payment,
    invoice: {
      paid_amount: toCurrencyNumber(projected),
      outstanding: toCurrencyNumber(clampedDifference(total, projected)),
      status: newStatus,
    },
  }, { status: 201 })
}

function deriveStatus(paid: Decimal, total: Decimal, currentStatus: string, dueDate: string | null): string {
  if (['cancelled', 'void'].includes(currentStatus)) return currentStatus
  // Exact paise comparison — no float tolerance needed.
  if (gteToPaise(paid, total)) return 'paid'
  if (paid.gt(0)) return 'partially_paid'
  if (currentStatus === 'paid' || currentStatus === 'partially_paid') {
    const today = new Date().toISOString().split('T')[0]
    return dueDate && dueDate < today ? 'overdue' : 'sent'
  }
  return currentStatus
}
