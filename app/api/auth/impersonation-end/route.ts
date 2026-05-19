/**
 * End an active impersonation session — Phase 5 §8.3, post-Supabase-Auth.
 *
 * Three side-effects:
 *   1. Stamp `platform_impersonation_log.ended_at = now()` (idempotent).
 *   2. Insert `tenant_visible_audit` row `imperial.impersonation_ended`.
 *   3. Supabase signOut() — clears the auth cookies via @supabase/ssr.
 *
 * Returns the Admin Console redirect target so the client can navigate to it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'No active session.' }, { status: 401 })
  }

  const impersonatedBy = session.user.impersonatedBy
  if (!impersonatedBy) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 })
  }

  const orgId = session.user.orgId
  // Pull the impersonation_log_id from app_metadata — the synthesised
  // Session doesn't surface it directly, so we read it off the Supabase
  // user record via the server client.
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const logId =
    typeof user?.app_metadata?.impersonation_log_id === 'string'
      ? user.app_metadata.impersonation_log_id
      : null

  const adminBase = process.env.IMPERIAL_ADMIN_BASE_URL ?? 'https://imperialhealthcare.cloud'
  const redirectTo = orgId ? `${adminBase}/orgs/${orgId}` : adminBase

  // 1. Close the impersonation log row.
  if (logId) {
    const { error } = await supabaseAdmin
      .from('platform_impersonation_log')
      .update({ ended_at: new Date().toISOString() } as never)
      .eq('id', logId)
      .is('ended_at', null)
    if (error) console.error('[impersonation-end] log close FAILED:', error.message, { log_id: logId })
  }

  // 2. Tenant-visible audit row.
  if (orgId) {
    const { error } = await supabaseAdmin
      .from('tenant_visible_audit')
      .insert({
        org_id: orgId,
        event_type: 'imperial.impersonation_ended',
        imperial_admin_email: impersonatedBy.email ?? 'imperial-admin',
        reason: null,
        reference_type: 'impersonation_log',
        reference_id: logId,
      } as never)
    if (error) console.error('[impersonation-end] tenant_visible_audit INSERT FAILED:', error.message, { org_id: orgId, log_id: logId })
  }

  // 3. Clear the Supabase auth cookies. signOut() handles the cookie writes
  //    via the @supabase/ssr server client; we just return the response.
  await supabase.auth.signOut().catch(err => {
    console.error('[impersonation-end] signOut failed:', err)
  })

  return NextResponse.json({ success: true, redirectTo })
}
