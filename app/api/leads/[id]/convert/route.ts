import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params

  const { data: lead } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  if (lead.lead_status === 'converted') {
    return NextResponse.json({ error: 'Lead is already converted.' }, { status: 409 })
  }

  // ── 1. Resolve the account FIRST so the contact can be linked to it. ─
  // Match an existing account by name (case-insensitive) before creating
  // a new one so converting two leads from the same company doesn't
  // produce duplicate accounts.
  let accountId: string | null = null
  if (lead.company) {
    const { data: existingAccount } = await supabase
      .from('crm_accounts')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', lead.company)
      .limit(1)
      .maybeSingle()

    if (existingAccount) {
      accountId = existingAccount.id
    } else {
      const { data: newAccount } = await supabase
        .from('crm_accounts')
        .insert({
          org_id: orgId,
          name: lead.company,
          // Carry forward what we know from the lead. GSTIN + billing
          // address still need to be enriched manually via the account
          // edit page before invoicing. (`industry` isn't on crm_leads,
          // so we don't transfer it — it's an account-only field.)
          phone: lead.phone ?? null,
          account_type: 'customer',
          created_by: actorId,
        })
        .select('id')
        .single()
      if (newAccount) accountId = newAccount.id
    }
  }

  // ── 2. Create the contact with account_id already wired. ─────────────
  const { data: contact, error: contactError } = await supabase
    .from('crm_contacts')
    .insert({
      org_id: orgId,
      account_id: accountId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      job_title: lead.job_title,
      notes: lead.notes,
      tags: lead.tags,
      custom_fields: lead.custom_fields,
      created_by: actorId,
    })
    .select('id, first_name, last_name')
    .single()

  if (contactError || !contact) {
    return NextResponse.json({ error: 'Failed to create contact.' }, { status: 500 })
  }

  await supabase
    .from('crm_leads')
    .update({
      lead_status: 'converted',
      converted_to: contact.id,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'lead.converted',
    resource_type: 'crm_lead',
    resource_id: id,
    meta: { contact_id: contact.id, account_id: accountId },
  })

  return NextResponse.json({
    data: { contact, accountId, message: 'Lead converted successfully.' },
  }, { status: 201 })
}
