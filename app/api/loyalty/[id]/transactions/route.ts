import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_loyalty_transactions')
    .select(`*, crm_users!created_by(full_name)`)
    .eq('loyalty_account_id', id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
