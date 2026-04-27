import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const { data: leads } = await supabaseAdmin
    .from('crm_leads')
    .select('lead_status, lead_source, created_at')
    .eq('org_id', orgId)

  if (!leads) return NextResponse.json({ byStatus: [], bySource: [] })

  const statusMap: Record<string, number> = {}
  const sourceMap: Record<string, number> = {}

  for (const lead of leads) {
    const s = lead.lead_status ?? 'new'
    const src = lead.lead_source ?? 'unknown'
    statusMap[s] = (statusMap[s] ?? 0) + 1
    sourceMap[src] = (sourceMap[src] ?? 0) + 1
  }

  const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const bySource = Object.entries(sourceMap).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const qualified = leads.filter(l => ['qualified','converted'].includes(l.lead_status)).length
  const converted = leads.filter(l => l.lead_status === 'converted').length
  const total = leads.length

  return NextResponse.json({
    byStatus,
    bySource,
    summary: {
      total,
      qualified,
      converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0',
    },
  })
}
