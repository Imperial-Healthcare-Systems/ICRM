/**
 * Plain Session types — no longer depends on next-auth.
 *
 * Replaces the previous types/next-auth.d.ts module augmentation. The
 * shape mirrors what lib/session.ts (server) and lib/use-session.ts
 * (client) synthesise from Supabase Auth's auth.users.app_metadata.
 *
 * Lifted from the original types/next-auth.d.ts so existing call sites
 * (session.user.role, session.user.orgId, etc.) work unchanged.
 */

export type ImpersonatedBy = {
  identityId: string
  email: string
  name: string
  startedAt: string
} | null

export interface Session {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
    orgId: string
    planTier: string
    subscriptionStatus: string
    isAdmin: boolean
    isManager: boolean
    identityId?: string | null
    membershipId?: string | null
    membershipRole?: string | null
    impersonatedBy?: ImpersonatedBy
  }
  /** ISO timestamp the session expires at — synthesised, not load-bearing. */
  expires: string
}
