/**
 * Browser-side Supabase client for Client Components.
 *
 * Use this when a client component needs to:
 *   - Call supabase.auth.* (signOut, refreshSession, onAuthStateChange)
 *   - Subscribe to realtime channels with the user's RLS context
 *
 * For data fetching, prefer hitting an API route that uses the server
 * client — keeps RLS evaluation server-side and avoids leaking query
 * shape to the client bundle.
 */
'use client'

import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getBrowserSupabase() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return browserClient
}
