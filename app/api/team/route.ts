import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/lib/session'
import { checkReadLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user

  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const pageSize = Math.min(100, parseInt(req.nextUrl.searchParams.get('pageSize') ?? '50'))

  const { data, error: dbErr } = await supabase
    .from('crm_users')
    .select('id, full_name, email, role')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('full_name')
    .limit(pageSize)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
