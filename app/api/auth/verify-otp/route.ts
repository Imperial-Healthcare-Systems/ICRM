/**
 * POST /api/auth/verify-otp
 *
 * Server-side OTP verification + session cookie issuance.
 *
 * Body: { email: string, otp: string }
 *
 * Flow ORDER MATTERS:
 *   1. Look up identity + crm_users + active membership BY EMAIL. We resolve
 *      org context BEFORE verifying the OTP, because:
 *   2. Write app_metadata via admin API. This invalidates any existing
 *      refresh tokens — but the user has none yet at this stage, so no
 *      collateral damage. Crucially, doing this BEFORE verifyOtp means the
 *      session JWT that verifyOtp mints will already carry the new claims.
 *   3. verifyOtp — cookies are written with a session JWT that includes
 *      app_metadata.active_org_id and friends. No refreshSession() needed.
 *
 * The earlier "verify first, then update, then refresh" ordering breaks because
 * updateUserById invalidates refresh tokens, the subsequent refresh fails, and
 * @supabase/ssr clears the auth cookies on refresh failure.
 *
 * Security note: doing lookups before OTP verify means we touch admin APIs
 * on failed-OTP attempts. The writes are idempotent (computed from current
 * membership state — no privilege escalation), and send-otp's rate limit
 * caps the blast radius at 4 attempts/hour per email.
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
    // Accept 4-10 digit codes — Supabase OTP length is configurable per project.
    if (!/^\d{4,10}$/.test(otp)) {
      return NextResponse.json({ error: 'Enter the numeric OTP from the email.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── 1. Look up identity + crm_users + memberships BY EMAIL ───────
    const { data: identity } = await supabaseAdmin
      .from('identities')
      .select('id, is_platform_admin, last_active_org_id')
      .eq('email', normalizedEmail)
      .maybeSingle() as { data: { id: string; is_platform_admin: boolean; last_active_org_id: string | null } | null }

    if (!identity) {
      return NextResponse.json(
        { error: 'No account found for that email.' },
        { status: 403 },
      )
    }

    const { data: crmUser } = await supabaseAdmin
      .from('crm_users')
      .select(`
        id, email, full_name, role, org_id, is_active, crm_enabled,
        identity_id, membership_id,
        organisations!inner(subscription_status, plan_tier)
      `)
      .eq('identity_id', identity.id)
      .eq('is_active', true)
      .eq('crm_enabled', true)
      .maybeSingle()

    if (!crmUser) {
      return NextResponse.json(
        { error: 'CRM access is not enabled for this account.' },
        { status: 403 },
      )
    }

    const { data: memberships } = await supabaseAdmin
      .from('memberships')
      .select('id, org_id, role, status, crm_access')
      .eq('identity_id', identity.id)
      .eq('status', 'active')
      .eq('crm_access', true)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No active organisation membership found for this account.' },
        { status: 403 },
      )
    }

    const activeMembership =
      memberships.find(m => m.org_id === identity.last_active_org_id) ??
      memberships.find(m => m.org_id === crmUser.org_id) ??
      memberships[0]

    const org = Array.isArray(crmUser.organisations) ? crmUser.organisations[0] : crmUser.organisations
    let planTier = (org as { plan_tier?: string })?.plan_tier ?? 'starter'
    let subscriptionStatus = (org as { subscription_status?: string })?.subscription_status ?? 'trial'

    if (activeMembership.org_id !== crmUser.org_id) {
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

    // ── 2. Write app_metadata BEFORE verifyOtp ──────────────────────
    // No refresh tokens exist yet for this login attempt, so the
    // invalidation is harmless. The next verifyOtp will mint a session
    // JWT that already carries these claims.
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(identity.id, {
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
      return NextResponse.json(
        { error: 'Could not establish org context. Please try again.' },
        { status: 500 },
      )
    }

    // ── 3. Verify OTP — cookies are written with the fresh JWT ───────
    const supabase = await getServerSupabase()
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

    // ── 4. Update last_active_org_id (fire-and-forget) ──────────────
    await supabaseAdmin
      .from('identities')
      .update({ last_active_org_id: activeMembership.org_id })
      .eq('id', identity.id)

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
