/**
 * POST /api/auth/switch-org
 *
 * Body: { target_org_id: string }
 *
 * Changes the active organisation for the current Supabase Auth session.
 * Required after Phase D so that subsequent route calls see the new
 * current_org_id() inside RLS.
 *
 *   1. Read the caller from the Supabase session (cookie-backed).
 *   2. Verify they have an ACTIVE membership in target_org_id with crm_access.
 *   3. Update app_metadata.{active_org_id, active_membership_id, active_role,
 *      plan_tier, subscription_status} via the admin API.
 *   4. refreshSession so the cookie's JWT carries the new claims and RLS
 *      helpers (current_org_id) start returning the new org immediately.
 *   5. Persist identities.last_active_org_id so the next fresh login lands
 *      on the same org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase()

  // ── 1. Authenticate ────────────────────────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const identityId = user.id
  const currentOrgId =
    (user.app_metadata?.active_org_id as string | undefined) ?? null

  const body = await req.json().catch(() => ({}))
  const targetOrgId: string | undefined = body.target_org_id

  if (!targetOrgId) {
    return NextResponse.json({ error: 'target_org_id is required.' }, { status: 400 })
  }

  if (targetOrgId === currentOrgId) {
    return NextResponse.json({ ok: true, alreadyActive: true, target_org_id: targetOrgId })
  }

  // ── 2. Verify the target membership exists, is active, and grants CRM access ──
  const { data: mem } = await supabaseAdmin
    .from('memberships')
    .select('id, role, status, crm_access, org_id')
    .eq('identity_id', identityId)
    .eq('org_id', targetOrgId)
    .eq('status', 'active')
    .maybeSingle() as { data: { id: string; role: string; status: string; crm_access: boolean; org_id: string } | null }

  if (!mem) {
    return NextResponse.json(
      { error: 'You do not have an active membership in that organisation.' },
      { status: 403 },
    )
  }
  if (!mem.crm_access) {
    return NextResponse.json(
      { error: 'Your membership in that organisation does not grant CRM access.' },
      { status: 403 },
    )
  }

  // ── 3. Pull plan info for the target org ───────────────────────────
  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('plan_tier, subscription_status')
    .eq('id', targetOrgId)
    .maybeSingle() as { data: { plan_tier: string | null; subscription_status: string | null } | null }

  // ── 4. Update app_metadata via admin API ───────────────────────────
  const newMetadata = {
    ...(user.app_metadata ?? {}),
    active_org_id:        targetOrgId,
    active_membership_id: mem.id,
    active_role:          mem.role,
    plan_tier:            org?.plan_tier ?? 'starter',
    subscription_status:  org?.subscription_status ?? 'trial',
  }

  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(identityId, {
    app_metadata: newMetadata,
  })
  if (metaErr) {
    console.error('[switch-org] updateUserById failed:', metaErr)
    return NextResponse.json({ error: 'Failed to switch organisation.' }, { status: 500 })
  }

  // ── 5. Refresh so the cookie's JWT carries the new claims ──────────
  const { error: refreshErr } = await supabase.auth.refreshSession()
  if (refreshErr) {
    console.error('[switch-org] refreshSession failed:', refreshErr)
    // Non-fatal — the new claims will land on the next natural refresh.
  }

  // ── 6. Persist last_active_org_id + audit ──────────────────────────
  await supabaseAdmin
    .from('identities')
    .update({ last_active_org_id: targetOrgId, updated_at: new Date().toISOString() })
    .eq('id', identityId)

  logAudit({
    org_id: targetOrgId,
    actor_id: identityId,
    action: 'org.switched',
    resource_type: 'membership',
    resource_id: mem.id,
    meta: {
      from_org_id: currentOrgId,
      to_org_id: targetOrgId,
      identity_id: identityId,
    },
  })

  return NextResponse.json({
    ok: true,
    target_org_id: targetOrgId,
    membership_role: mem.role,
  })
}
