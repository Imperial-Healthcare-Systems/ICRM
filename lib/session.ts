/**
 * Session helpers — Supabase Auth backed (post Phase E migration).
 *
 * The public surface here is intentionally unchanged from the NextAuth era:
 * `requireSession`, `requireRole`, `requireOrgManager`, `getTenantClient`,
 * `requireWriteAccess`, `requireExportAccess` all return the same shapes as
 * before so the ~114 existing API routes need zero changes.
 *
 * What changed internally:
 *   - Session is read from the cookie-backed Supabase server client, not
 *     from getServerSession(authOptions).
 *   - Session.user fields are synthesised from auth.users.app_metadata
 *     which is written on /api/auth/verify-otp and /api/auth/switch-org.
 *   - Impersonation log liveness is checked on every requireSession() call:
 *     if app_metadata.impersonation_log_id refers to a row whose ended_at
 *     is non-NULL, the Supabase session is signed out and the call returns
 *     401. This enforces the 1-hour impersonation cap (the hourly zombie
 *     sweeper closes stale rows; requireSession() reacts to that closure).
 */
import { NextResponse } from 'next/server'
import type { Session } from '@/types/session'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getServerSupabase } from './supabase-server'
import { supabaseAdmin } from './supabase'
import { getTenantSupabase } from './supabaseTenant'
import { getOrgAccountState, type AccountCapabilities } from './account-state'

type Ok<T> = T & { error: null }
type Err = { error: NextResponse }

const LEGACY_MANAGER_ROLES = new Set(['super_admin', 'admin', 'manager'])
const NEW_MANAGER_ROLES = new Set(['owner', 'admin', 'hr_admin', 'crm_admin', 'manager'])
const ADMIN_ROLES = new Set(['owner', 'admin', 'hr_admin', 'crm_admin', 'super_admin'])

/**
 * Read the current Supabase session and synthesise a NextAuth-shaped
 * Session object so existing callers keep working. Returns null if there
 * is no session OR if the session is an impersonation whose log row has
 * been closed.
 *
 * Exported as `getSession()` for server components that need a soft read
 * (no error response generation). Route handlers should still use
 * requireSession() to get the 401-wrapping behaviour.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await getServerSupabase()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>

  // Impersonation cap enforcement — close the session if the log row ended.
  const impersonationLogId = typeof meta.impersonation_log_id === 'string' ? meta.impersonation_log_id : null
  const isImpersonating = meta.is_impersonating === true
  if (isImpersonating && impersonationLogId) {
    const { data: log } = await supabaseAdmin
      .from('platform_impersonation_log')
      .select('ended_at')
      .eq('id', impersonationLogId)
      .maybeSingle() as { data: { ended_at: string | null } | null }

    if (!log || log.ended_at) {
      await supabase.auth.signOut().catch(() => {})
      return null
    }
  }

  const role = typeof meta.active_role === 'string' ? meta.active_role : 'member'
  const orgId = typeof meta.active_org_id === 'string' ? meta.active_org_id : ''
  const membershipId = typeof meta.active_membership_id === 'string' ? meta.active_membership_id : null
  const planTier = typeof meta.plan_tier === 'string' ? meta.plan_tier : 'starter'
  const subscriptionStatus = typeof meta.subscription_status === 'string' ? meta.subscription_status : 'trial'
  const impersonatorAdminId = typeof meta.impersonator_admin_id === 'string' ? meta.impersonator_admin_id : null

  // ── Resolve crm_users.id for the current identity + active org ──────
  // session.user.id must be crm_users.id, not identities.id — every FK
  // in the CRM (assigned_to, created_by, …) references crm_users(id).
  // Routes that genuinely need the auth-level UUID read session.user.identityId.
  let crmUserId: string | null = null
  if (orgId) {
    const { data: crmUser } = await supabaseAdmin
      .from('crm_users')
      .select('id')
      .eq('identity_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle() as { data: { id: string } | null }
    crmUserId = crmUser?.id ?? null
  }

  const session: Session = {
    user: {
      // session.user.id = crm_users.id when one exists (so FK inserts to
      // assigned_to/created_by/etc. resolve correctly). Falls back to the
      // identity_id when no crm_users row exists for this identity in the
      // active org — that path should be rare and any FK insert with it
      // will fail loudly, surfacing a misconfigured user.
      id: crmUserId ?? user.id,
      email: user.email ?? '',
      name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
      image: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
      role,
      orgId,
      planTier,
      subscriptionStatus,
      isAdmin: ADMIN_ROLES.has(role),
      isManager: LEGACY_MANAGER_ROLES.has(role) || NEW_MANAGER_ROLES.has(role),
      identityId: user.id,
      membershipId,
      membershipRole: role,
      impersonatedBy: isImpersonating && impersonatorAdminId
        ? { identityId: impersonatorAdminId, email: '', name: '', startedAt: '' }
        : null,
    },
    expires: '',
  } as Session

  return session
}

export async function requireSession(): Promise<Ok<{ session: Session }> | (Err & { session: null })> {
  const session = await getSession()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }
  if (!session.user.orgId) {
    return {
      session: null,
      error: NextResponse.json({ error: 'No active organisation.' }, { status: 403 }),
    }
  }
  return { session, error: null }
}

export async function requireRole(
  allowedRoles: string[],
): Promise<Ok<{ session: Session }> | (Err & { session: null })> {
  const result = await requireSession()
  if (result.error) return result
  if (!allowedRoles.includes(result.session.user.role)) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }
  return result
}

export async function requireOrgManager(): Promise<Ok<{ session: Session }> | (Err & { session: null })> {
  const result = await requireSession()
  if (result.error) return result

  const { role, membershipRole } = result.session.user
  const isManager =
    LEGACY_MANAGER_ROLES.has(role) ||
    (membershipRole != null && NEW_MANAGER_ROLES.has(membershipRole))

  if (!isManager) {
    return { session: null, error: NextResponse.json({ error: 'Manager access required.' }, { status: 403 }) }
  }
  return result
}

export async function getTenantClient(): Promise<
  | Ok<{ session: Session; supabase: SupabaseClient }>
  | (Err & { session: null; supabase: null })
> {
  const result = await requireSession()
  if (result.error) return { ...result, supabase: null }

  if (!result.session.user.identityId) {
    return {
      session: null,
      supabase: null,
      error: NextResponse.json(
        { error: 'Session missing identity — please sign out and sign in again.' },
        { status: 409 },
      ),
    }
  }

  const supabase = await getTenantSupabase()
  return { session: result.session, supabase, error: null }
}

export async function requireWriteAccess(): Promise<
  | Ok<{ session: Session; supabase: SupabaseClient; capabilities: AccountCapabilities }>
  | (Err & { session: null; supabase: null; capabilities: null })
> {
  const result = await getTenantClient()
  if (result.error) return { ...result, capabilities: null }

  const capabilities = await getOrgAccountState(result.supabase, result.session.user.orgId)

  if (!capabilities.canWrite) {
    return {
      session: null,
      supabase: null,
      capabilities: null,
      error: NextResponse.json(
        {
          error: capabilities.message ?? 'Your account does not allow modifications at this time.',
          state: capabilities.state,
        },
        { status: 402 },
      ),
    }
  }

  return { session: result.session, supabase: result.supabase, capabilities, error: null }
}

export async function requireExportAccess(): Promise<
  | Ok<{ session: Session; supabase: SupabaseClient; capabilities: AccountCapabilities }>
  | (Err & { session: null; supabase: null; capabilities: null })
> {
  const result = await getTenantClient()
  if (result.error) return { ...result, capabilities: null }

  const capabilities = await getOrgAccountState(result.supabase, result.session.user.orgId)

  if (!capabilities.canExport) {
    return {
      session: null,
      supabase: null,
      capabilities: null,
      error: NextResponse.json(
        {
          error: capabilities.message ?? 'Your account does not allow exports at this time.',
          state: capabilities.state,
        },
        { status: 402 },
      ),
    }
  }

  return { session: result.session, supabase: result.supabase, capabilities, error: null }
}
