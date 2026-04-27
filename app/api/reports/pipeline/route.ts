import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const { data: stages } = await supabaseAdmin
    .from('crm_pipeline_stages')
    .select('id, name, color, position, is_won, is_lost')
    .eq('org_id', orgId)
    .order('position')

  const { data: deals } = await supabaseAdmin
    .from('crm_deals')
    .select('stage_id, deal_value, deal_status')
    .eq('org_id', orgId)

  const result = (stages ?? []).map(s => {
    const stageDeals = deals?.filter(d => d.stage_id === s.id) ?? []
    return {
      name: s.name,
      color: s.color,
      is_won: s.is_won,
      is_lost: s.is_lost,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (d.deal_value ?? 0), 0),
    }
  })

  const total = deals?.length ?? 0
  const won = deals?.filter(d => stages?.find(s => s.id === d.stage_id && s.is_won)) ?? []
  const lost = deals?.filter(d => stages?.find(s => s.id === d.stage_id && s.is_lost)) ?? []

  return NextResponse.json({
    stages: result,
    summary: {
      total,
      won: won.length,
      lost: lost.length,
      winRate: total > 0 ? ((won.length / total) * 100).toFixed(1) : '0',
      totalValue: deals?.reduce((s, d) => s + (d.deal_value ?? 0), 0) ?? 0,
    },
  })
}
