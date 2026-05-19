/**
 * Legacy impersonation-end path retained for backward compatibility.
 * Delegates to the same logic as `/api/auth/impersonation-end` — see
 * that file for the canonical implementation. New callers should use
 * the canonical path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'No active session.' }, { status: 401 })
  }

  const impersonatedBy = session.user.impersonatedBy
  if (!impersonatedBy) {
    return NextResponse.json({ error: 'No impersonation session to end.' }, { status: 400 })
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const logId =
    typeof user?.app_metadata?.impersonation_log_id === 'string'
      ? user.app_metadata.impersonation_log_id
      : null

  // Close the log row.
  if (logId) {
    await supabaseAdmin
      .from('platform_impersonation_log')
      .update({ ended_at: new Date().toISOString() } as never)
      .eq('id', logId)
      .is('ended_at', null)
  }

  logAudit({
    org_id: session.user.orgId,
    actor_id: session.user.id,
    action: 'impersonation.ended',
    resource_type: 'crm_user',
    resource_id: session.user.id,
    meta: {
      impersonated_by_identity_id: impersonatedBy.identityId,
      impersonated_by_email: impersonatedBy.email,
      started_at: impersonatedBy.startedAt,
      ended_at: new Date().toISOString(),
      impersonation_log_id: logId,
    },
  })

  // Sign out — clears Supabase auth cookies on the outgoing response.
  await supabase.auth.signOut().catch(err => {
    console.error('[impersonation/end] signOut failed:', err)
  })

  const url = new URL(req.url)
  const adminConsoleUrl = process.env.IMPERIAL_ADMIN_CONSOLE_URL ?? 'https://imperialhealthcare.cloud'
  const callbackUrl = `${adminConsoleUrl}/impersonation/returned`

  return NextResponse.json({
    success: true,
    redirectTo: callbackUrl,
    callbackUrl,
    // Preserved for callers that still expect a `signOutUrl` field.
    signOutUrl: new URL('/login', url).toString(),
  })
}
