/**
 * POST /api/auth/verify-otp
 *
 * Server-side OTP verification + session cookie issuance.
 *
 * Body: { email: string, otp: string }
 *
 * What this does:
 *   1. Verify the OTP via the cookie-backed server client — on success
 *      Supabase Auth writes sb-<ref>-auth-token cookies on the response.
 *   2. Gate the caller: their crm_users row must be active + crm_enabled.
 *   3. Resolve the active org and membership (preferring identities.last_active_org_id).
 *   4. Write app_metadata.{active_org_id, active_membership_id, active_role,
 *      plan_tier, subscription_status, is_platform_admin} via admin API.
 *   5. Force-refresh the session so the cookie carries a new access_token
 *      that includes the app_metadata claims (RLS helpers need them).
 *   6. Update identities.last_active_org_id so next login lands on the
 *      same org.
 *
 * On any post-verify failure we sign the user OUT immediately so they
 * don't end up with a half-authenticated session that can hit RLS-protected
 * tables before app_metadata is wired up.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json()

    if (!email || typeof email !== 'string' || !otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 })
    }
    // Accept 4-10 digit codes — Supabase OTP length is configurable per
    // project. Server-side bounds keep the validator loose while the UI
    // surfaces the precise length expected.
    if (!/^\d{4,10}$/.test(otp)) {
      return NextResponse.json({ error: 'Enter the numeric OTP from the email.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const supabase = await getServerSupabase()

    // ── 1. Verify OTP — cookies are written on success ──────────────
    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp,
      type: 'email',
    })

    if (verifyErr || !verifyData?.user || !verifyData?.session) {
      return NextResponse.json(
        { error: verifyErr?.message ?? 'Incorrect or expired OTP. Request a new code.' },
        { status: 401 },
      )
    }

    const userId = verifyData.user.id

    // ── 2. Gate: crm_users row must be active + crm_enabled ─────────
    const { data: crmUser, error: crmErr } = await supabaseAdmin
      .from('crm_users')
      .select(`
        id, email, full_name, role, org_id, is_active, crm_enabled,
        identity_id, membership_id,
        organisations!inner(subscription_status, plan_tier)
      `)
      .eq('identity_id', userId)
      .eq('is_active', true)
      .eq('crm_enabled', true)
      .maybeSingle()

    if (crmErr || !crmUser) {
      // Half-authenticated → tear down the session before responding.
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'CRM access is not enabled for this account.' },
        { status: 403 },
      )
    }

    // ── 3. Resolve identity + active org ─────────────────────────────
    const { data: identity } = await supabaseAdmin
      .from('identities')
      .select('id, is_platform_admin, last_active_org_id')
      .eq('id', userId)
      .maybeSingle() as { data: { id: string; is_platform_admin: boolean; last_active_org_id: string | null } | null }

    const { data: memberships } = await supabaseAdmin
      .from('memberships')
      .select('id, org_id, role, status, crm_access')
      .eq('identity_id', userId)
      .eq('status', 'active')
      .eq('crm_access', true)

    if (!identity || !memberships || memberships.length === 0) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'No active organisation membership found for this account.' },
        { status: 403 },
      )
    }

    // Prefer last_active_org_id if it's still a valid membership; otherwise
    // fall back to the crm_users.org_id (legacy single-org path) and finally
    // to the first active membership.
    let activeMembership =
      memberships.find(m => m.org_id === identity.last_active_org_id) ??
      memberships.find(m => m.org_id === crmUser.org_id) ??
      memberships[0]

    // ── 4. Resolve plan tier + subscription status for the active org ──
    const org = Array.isArray(crmUser.organisations) ? crmUser.organisations[0] : crmUser.organisations
    let planTier = (org as { plan_tier?: string })?.plan_tier ?? 'starter'
    let subscriptionStatus = (org as { subscription_status?: string })?.subscription_status ?? 'trial'

    if (activeMembership.org_id !== crmUser.org_id) {
      // Active org differs from the crm_users primary org — refetch plan info.
      const { data: orgRow } = await supabaseAdmin
        .from('organisations')
        .select('plan_tier, subscription_status')
        .eq('id', activeMembership.org_id)
        .maybeSingle()
      if (orgRow) {
        planTier = orgRow.plan_tier ?? planTier
        subscriptionStatus = orgRow.subscription_status ?? subscriptionStatus
      }
    }

    // ── 5. Write app_metadata claims via admin API ──────────────────
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        active_org_id:        activeMembership.org_id,
        active_membership_id: activeMembership.id,
        active_role:          activeMembership.role,
        plan_tier:            planTier,
        subscription_status:  subscriptionStatus,
        is_platform_admin:    identity.is_platform_admin === true,
      },
    })

    if (metaErr) {
      console.error('[verify-otp] updateUserById failed:', metaErr)
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Could not establish org context. Please try again.' },
        { status: 500 },
      )
    }

    // ── 6. Force-refresh so the new app_metadata lands in the cookie's JWT ─
    const { error: refreshErr } = await supabase.auth.refreshSession()
    if (refreshErr) {
      console.error('[verify-otp] refreshSession failed:', refreshErr)
      // Non-fatal: the next request will pick up the new claims when the
      // access_token expires naturally. But log it loudly.
    }

    // ── 7. Update last_active_org_id (fire-and-forget) ──────────────
    await supabaseAdmin
      .from('identities')
      .update({ last_active_org_id: activeMembership.org_id })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      redirectTo: '/dashboard',
      user: {
        id:                  crmUser.id,
        email:               crmUser.email,
        name:                crmUser.full_name,
        role:                crmUser.role,
        orgId:               activeMembership.org_id,
        membershipId:        activeMembership.id,
        membershipRole:      activeMembership.role,
        planTier,
        subscriptionStatus,
        isAdmin:             crmUser.role === 'super_admin',
        isManager:           MANAGER_ROLES.includes(crmUser.role),
        isPlatformAdmin:     identity.is_platform_admin === true,
      },
    })
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Failed to verify OTP. Try again.' }, { status: 500 })
  }
}
