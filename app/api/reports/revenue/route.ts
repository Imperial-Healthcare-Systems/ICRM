import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const months = parseInt(req.nextUrl.searchParams.get('months') ?? '6')
  const result: { month: string; revenue: number; invoices: number }[] = []

  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })

    const { data } = await supabaseAdmin
      .from('crm_invoices')
      .select('total')
      .eq('org_id', orgId)
      .eq('status', 'paid')
      .gte('paid_date', start)
      .lte('paid_date', end)

    result.push({
      month: label,
      revenue: data?.reduce((s, r) => s + (r.total ?? 0), 0) ?? 0,
      invoices: data?.length ?? 0,
    })
  }

  return NextResponse.json({ data: result })
}
