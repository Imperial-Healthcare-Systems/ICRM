import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

function publicUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  return `${base}/invoice/${token}`
}

/* Generate (or return existing) public sharing token for an invoice. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const { data: invoice } = await supabaseAdmin
    .from('crm_invoices')
    .select('id, public_token')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  if (invoice.public_token) {
    return NextResponse.json({ token: invoice.public_token, url: publicUrl(invoice.public_token), reused: true })
  }

  const token = crypto.randomBytes(24).toString('hex')
  const { error: updErr } = await supabaseAdmin
    .from('crm_invoices')
    .update({ public_token: token, public_token_created_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'invoice.shared', resource_type: 'crm_invoice', resource_id: id })
  return NextResponse.json({ token, url: publicUrl(token), reused: false }, { status: 201 })
}

/* Revoke the public token. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const { id } = await params
  const { error: updErr } = await supabaseAdmin
    .from('crm_invoices')
    .update({ public_token: null, public_token_created_at: null })
    .eq('id', id)
    .eq('org_id', orgId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'invoice.share_revoked', resource_type: 'crm_invoice', resource_id: id })
  return NextResponse.json({ success: true })
}
