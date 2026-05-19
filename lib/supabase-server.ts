/**
 * Per-request, user-scoped Supabase client for Server Components and
 * Route Handlers.
 *
 * Reads/writes the Supabase Auth session via the Next.js cookies() API.
 * The returned client carries the user's JWT, so PostgREST honours RLS
 * policies — `auth.uid()`, `current_org_id()`, `is_imperial_admin()`
 * all return real values inside SQL.
 *
 * Use this when the route is acting *on behalf of a logged-in user*:
 *   const supabase = await getServerSupabase()
 *   const { data, error } = await supabase.from('crm_leads').select('*')
 *
 * Do NOT use for cron jobs, webhooks, or admin operations — those need
 * the service-role client at `lib/supabase.ts` (supabaseAdmin).
 *
 * Cookie names follow Supabase's defaults (sb-<project-ref>-auth-token
 * and -code-verifier). Do not rename them — the @supabase/ssr helpers
 * encode/decode the session there.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll can be called from a Server Component, where Next.js
            // disallows cookie writes. The middleware refreshes the session
            // on its next pass, so this is safe to ignore here.
          }
        },
      },
    },
  )
}
