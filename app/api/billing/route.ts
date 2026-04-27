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

  const [creditsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('org_credits').select('balance, total_purchased, updated_at').eq('org_id', orgId).single(),
    supabaseAdmin.from('credit_transactions')
      .select('id, feature_key, amount, direction, ref_id, description, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    balance: creditsRes.data?.balance ?? 0,
    totalPurchased: creditsRes.data?.total_purchased ?? 0,
    lastUpdated: creditsRes.data?.updated_at,
    transactions: historyRes.data ?? [],
  })
}
