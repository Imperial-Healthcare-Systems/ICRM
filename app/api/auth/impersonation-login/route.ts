/**
 * Impersonation receiver — Phase 5 of IMPERIAL_TENANT_SPEC v1.0 §8.2,
 * rewritten for Supabase Auth.
 *
 *   1. Verify the HS256 impersonation token (IMPERSONATION_SECRET).
 *   2. Validate platform_impersonation_log is open + within window.
 *   3. Resolve identity_id (Path A: direct membership; Path B: legacy
 *      crm_users.id → identity_id legacy fallback).
 *   4. Write app_metadata on the TARGET auth.users carrying the
 *      impersonation flags + active org/membership/role/plan claims.
 *   5. Mint a Supabase session for the target via admin.generateLink +
 *      server-side verifyOtp(token_hash). Cookies are written by the
 *      @supabase/ssr server client onto the redirect response.
 *   6. Refresh once so the cookie's JWT carries the new app_metadata.
 *   7. Insert tenant_visible_audit row (§8.3 — customer must see this).
 *   8. Redirect to /dashboard?impersonating=1.
 *
 * The 1-hour impersonation cap is enforced via the platform_impersonation_log
 * row. lib/session.ts (Phase E) reads app_metadata.impersonation_log_id on
 * every requireAuth() and force-signs-out the session if the log row's
 * ended_at is non-NULL. The hourly zombie sweeper closes stale rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSupabase } from '@/lib/supabase-server'
import { verifyImpersonationToken } from '@/lib/auth-shared/jwt-claims'

const SESSION_MAX_AGE_SECONDS = 3600 // 1 hour — enforced via log row check

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    if (!process.env.IMPERSONATION_SECRET) {
      return NextResponse.json({ error: 'IMPERSONATION_SECRET not configured' }, { status: 500 })
    }

    // 1. Verify the impersonation token signature + claims.
    let claims
    try {
      claims = await verifyImpersonationToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    if (!claims.sub || !claims.orgId || !claims.impersonator || !claims.logId) {
      return NextResponse.json({ error: 'Malformed token' }, { status: 401 })
    }

    // 2. Validate the impersonation log row is still open + within window.
    const { data: log } = (await supabaseAdmin
      .from('platform_impersonation_log')
      .select('id, ended_at, started_at')
      .eq('id', claims.logId)
      .maybeSingle()) as { data: { id: string; ended_at: string | null; started_at: string } | null }

    if (!log) {
      return NextResponse.json({ error: 'Impersonation session not found' }, { status: 403 })
    }
    if (log.ended_at) {
      return NextResponse.json({ error: 'Impersonation session already ended' }, { status: 403 })
    }
    if (Date.now() - new Date(log.started_at).getTime() > SESSION_MAX_AGE_SECONDS * 1000) {
      return NextResponse.json({ error: 'Impersonation session expired' }, { status: 401 })
    }

    // 3. Resolve identity + membership for the target.
    let identityId = claims.sub
    let membershipId: string | null = null
    let role: string = 'member'

    const { data: directMembership } = (await supabaseAdmin
      .from('memberships')
      .select('id, role')
      .eq('identity_id', identityId)
      .eq('org_id', claims.orgId)
      .eq('status', 'active')
      .maybeSingle()) as { data: { id: string; role: string } | null }

    if (directMembership) {
      membershipId = directMembership.id
      role = directMembership.role
    } else {
      // Legacy fallback: claims.sub was a crm_users.id.
      const { data: cu } = (await supabaseAdmin
        .from('crm_users')
        .select('identity_id, membership_id')
        .eq('id', claims.sub)
        .eq('org_id', claims.orgId)
        .maybeSingle()) as { data: { identity_id: string | null; membership_id: string | null } | null }

      if (!cu || !cu.identity_id || !cu.membership_id) {
        return NextResponse.json({ error: 'Target user not found in this org' }, { status: 404 })
      }
      identityId = cu.identity_id
      membershipId = cu.membership_id

      const { data: m } = (await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('id', membershipId)
        .maybeSingle()) as { data: { role: string } | null }
      role = m?.role ?? 'member'
    }

    // 4. Hydrate target's identity + org metadata for the audit row + plan claims.
    const [identityRes, orgRes] = await Promise.all([
      supabaseAdmin
        .from('identities')
        .select('email, is_platform_admin')
        .eq('id', identityId)
        .maybeSingle(),
      supabaseAdmin
        .from('organisations')
        .select('plan_tier, subscription_status')
        .eq('id', claims.orgId)
        .maybeSingle(),
    ])
    const identity = identityRes.data as { email: string; is_platform_admin: boolean | null } | null
    const org = orgRes.data as { plan_tier: string | null; subscription_status: string | null } | null

    if (!identity?.email) {
      return NextResponse.json({ error: 'Target identity missing email' }, { status: 500 })
    }

    // 5. Write app_metadata on the target user — replaces any previous metadata
    //    so a half-finished impersonation can't leak claims forward. The next
    //    normal verify-otp login will overwrite this with fresh non-impersonation
    //    metadata.
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(identityId, {
      app_metadata: {
        active_org_id:        claims.orgId,
        active_membership_id: membershipId,
        active_role:          role,
        plan_tier:            org?.plan_tier ?? 'starter',
        subscription_status:  org?.subscription_status ?? 'active',
        is_platform_admin:    identity.is_platform_admin === true,
        is_impersonating:     true,
        impersonator_admin_id: claims.impersonator,
        impersonation_log_id:  claims.logId,
      },
    })
    if (metaErr) {
      console.error('[impersonation-login] updateUserById failed:', metaErr)
      return NextResponse.json({ error: 'Failed to write impersonation claims' }, { status: 500 })
    }

    // 6. Mint a Supabase session for the target — generateLink returns a
    //    hashed_token we can verify server-side without sending any email.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: identity.email,
    })
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('[impersonation-login] generateLink failed:', linkErr)
      return NextResponse.json({ error: 'Failed to mint impersonation session' }, { status: 500 })
    }

    // The redirect response is what verifyOtp will write cookies onto.
    const redirect = NextResponse.redirect(new URL('/dashboard?impersonating=1', req.url))

    // Server client bound to the OUTGOING response's cookie store.
    const supabase = await getServerSupabase()
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })
    if (verifyErr) {
      console.error('[impersonation-login] verifyOtp failed:', verifyErr)
      return NextResponse.json({ error: 'Failed to establish impersonation session' }, { status: 500 })
    }

    // 7. Force-refresh so the JWT inside the just-set cookie carries the
    //    is_impersonating + active_org_id claims (verifyOtp issued a token
    //    before our app_metadata write took effect on the user record).
    await supabase.auth.refreshSession().catch(err => {
      console.error('[impersonation-login] refreshSession failed:', err)
    })

    // 8. tenant_visible_audit (§8.3 — customer must see this).
    let imperialAdminEmail = 'imperial-admin'
    {
      const { data: adminIdentity } = (await supabaseAdmin
        .from('identities')
        .select('email')
        .eq('id', claims.impersonator)
        .maybeSingle()) as { data: { email: string } | null }
      if (adminIdentity?.email) {
        imperialAdminEmail = adminIdentity.email
      } else {
        const { data: adminEmp } = (await supabaseAdmin
          .from('employees')
          .select('work_email, personal_email')
          .eq('id', claims.impersonator)
          .maybeSingle()) as { data: { work_email: string | null; personal_email: string | null } | null }
        if (adminEmp?.work_email) imperialAdminEmail = adminEmp.work_email
        else if (adminEmp?.personal_email) imperialAdminEmail = adminEmp.personal_email
      }
    }

    const { error: auditErr } = await supabaseAdmin
      .from('tenant_visible_audit')
      .insert({
        org_id: claims.orgId,
        event_type: 'imperial.impersonation',
        imperial_admin_email: imperialAdminEmail,
        reason: claims.reason ?? null,
        reference_type: 'impersonation_log',
        reference_id: claims.logId,
        metadata: { impersonator_id: claims.impersonator, target_identity_id: identityId },
      } as never)
    if (auditErr) {
      console.error('[impersonation-login] tenant_visible_audit INSERT FAILED:', auditErr.message, {
        org_id: claims.orgId, event_type: 'imperial.impersonation',
      })
    }

    return redirect
  } catch (err) {
    console.error('[auth/impersonation-login GET]', err)
    const message = err instanceof Error ? err.message : 'Impersonation login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
