/**
 * Drop-in replacement for `next-auth/react`'s `useSession()` hook,
 * backed by Supabase Auth via the browser client.
 *
 * Returns the same shape: `{ data, status, update }` where:
 *   - data: the synthesised NextAuth-shaped Session object (or null)
 *   - status: 'loading' | 'authenticated' | 'unauthenticated'
 *   - update: refreshes the session from Supabase (replaces NextAuth's
 *             update() which triggered a JWT callback re-run)
 *
 * Existing components import { useSession } from 'next-auth/react' →
 * change the import to { useSession } from '@/lib/use-session'.
 *
 * Synthesises the Session.user fields from auth.users.app_metadata,
 * mirroring lib/session.ts's server-side getSession() — so client and
 * server agree on session shape.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@/types/session'
import type { AuthChangeEvent, Session as SupabaseSession, User } from '@supabase/supabase-js'
import { getBrowserSupabase } from './supabase-browser'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

const LEGACY_MANAGER_ROLES = new Set(['super_admin', 'admin', 'manager'])
const NEW_MANAGER_ROLES = new Set(['owner', 'admin', 'hr_admin', 'crm_admin', 'manager'])
const ADMIN_ROLES = new Set(['owner', 'admin', 'hr_admin', 'crm_admin', 'super_admin'])

function synthesiseSession(user: User | null): Session | null {
  if (!user) return null

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  const role = typeof meta.active_role === 'string' ? meta.active_role : 'member'
  const orgId = typeof meta.active_org_id === 'string' ? meta.active_org_id : ''
  const membershipId = typeof meta.active_membership_id === 'string' ? meta.active_membership_id : null
  const planTier = typeof meta.plan_tier === 'string' ? meta.plan_tier : 'starter'
  const subscriptionStatus = typeof meta.subscription_status === 'string' ? meta.subscription_status : 'trial'
  const isImpersonating = meta.is_impersonating === true
  const impersonatorAdminId = typeof meta.impersonator_admin_id === 'string' ? meta.impersonator_admin_id : null

  return {
    user: {
      id: user.id,
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
}

export function useSession() {
  const [data, setData] = useState<Session | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const next = synthesiseSession(user)
    setData(next)
    setStatus(next ? 'authenticated' : 'unauthenticated')
  }, [])

  // `update()` keeps the next-auth contract: callers can pass anything
  // (we ignore the payload) and trigger a fresh session read. The server
  // is the source of truth — app_metadata changes via the admin API,
  // refreshSession picks them up, this hook re-reads.
  const update = useCallback(async (_?: unknown) => {
    const supabase = getBrowserSupabase()
    await supabase.auth.refreshSession()
    await refresh()
    return data
  }, [refresh, data])

  useEffect(() => {
    let cancelled = false
    void refresh()

    const supabase = getBrowserSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: SupabaseSession | null) => {
        if (cancelled) return
        const next = synthesiseSession(session?.user ?? null)
        setData(next)
        setStatus(next ? 'authenticated' : 'unauthenticated')
      },
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [refresh])

  return { data, status, update }
}
