import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const pageSize = Math.min(50, Number(url.searchParams.get('limit') ?? 20))

  const { data } = await supabaseAdmin
    .from('crm_activities')
    .select('id, subject, activity_type, status, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(pageSize)

  return NextResponse.json({ data: data ?? [], unread: data?.length ?? 0 })
}
