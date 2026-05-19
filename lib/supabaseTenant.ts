/**
 * Tenant-scoped Supabase client seam.
 *
 * Before the Supabase Auth migration, this was a pass-through to
 * supabaseAdmin (service_role) because PostgREST stopped accepting
 * app-signed HS256 JWTs after the project moved to asymmetric JWT
 * Signing Keys.
 *
 * After the migration, this returns the per-request, cookie-backed
 * Supabase client from `lib/supabase-server.ts`. That client carries
 * the user's real session JWT, so PostgREST applies RLS — current_org_id(),
 * is_imperial_admin(), and auth.uid() all return real values inside SQL.
 *
 * The `_session` argument is retained for backwards compatibility with
 * existing call sites; it is no longer used (the session lives in the
 * cookie store now).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerSupabase } from './supabase-server'

export async function getTenantSupabase(_session?: unknown): Promise<SupabaseClient> {
  return getServerSupabase()
}
