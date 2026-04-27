import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit } from '@/lib/rate-limit'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { data } = await supabaseAdmin
    .from('ecosystem_events')
    .select('id, event_type, source_platform, payload, processed, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  return NextResponse.json({ data: data ?? [] })
}
