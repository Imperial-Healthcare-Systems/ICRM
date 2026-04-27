import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { account_id, label, days = 30 } = await req.json()
  if (!account_id) return NextResponse.json({ error: 'account_id is required.' }, { status: 400 })

  // Verify account belongs to org
  const { data: account } = await supabaseAdmin
    .from('crm_accounts')
    .select('id, name')
    .eq('id', account_id).eq('org_id', orgId)
    .single()

  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + Math.min(days, 90))

  // Revoke any existing active tokens for this account
  await supabaseAdmin
    .from('crm_portal_tokens')
    .update({ is_active: false })
    .eq('account_id', account_id).eq('org_id', orgId).eq('is_active', true)

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_portal_tokens')
    .insert({
      org_id: orgId,
      account_id,
      label: label ?? `Portal — ${account.name}`,
      expires_at: expiresAt.toISOString(),
      created_by: userId,
    })
    .select('token, expires_at, label')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Failed to generate portal token.' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'
  return NextResponse.json({
    token: data.token,
    portalUrl: `${appUrl}/portal/${data.token}`,
    expiresAt: data.expires_at,
    label: data.label,
    accountName: account.name,
  })
}
