import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { orderId } = await params

  const { data } = await supabaseAdmin
    .from('crm_payment_orders')
    .select('status, credits, amount_inr, package_id, created_at')
    .eq('cf_order_id', orderId)
    .eq('org_id', orgId)
    .single()

  if (!data) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const { data: credits } = await supabaseAdmin
    .from('org_credits')
    .select('balance')
    .eq('org_id', orgId)
    .single()

  return NextResponse.json({
    status: data.status,
    credits: data.credits,
    amount: data.amount_inr,
    packageId: data.package_id,
    currentBalance: credits?.balance ?? 0,
  })
}
