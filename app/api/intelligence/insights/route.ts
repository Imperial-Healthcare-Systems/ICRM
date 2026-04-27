import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { checkFeature, consumeCredits } from '@/lib/feature-gate'
import { getProviderForFeature } from '@/lib/ai/provider'
import { OpenAIAdapter } from '@/lib/ai/openai'
import { GeminiAdapter } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const gate = await checkFeature(orgId, 'ai_insights', 2)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason ?? 'Insufficient AI credits' }, { status: 402 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [deals, leads, invoices, tickets] = await Promise.all([
    supabaseAdmin.from('crm_deals').select('deal_value, deal_status, probability').eq('org_id', orgId).gte('updated_at', thirtyDaysAgo),
    supabaseAdmin.from('crm_leads').select('lead_status, lead_source').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('crm_invoices').select('total, status').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('crm_tickets').select('status, priority').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
  ])

  const won = deals.data?.filter(d => d.deal_status === 'won') ?? []
  const lost = deals.data?.filter(d => d.deal_status === 'lost') ?? []
  const open = deals.data?.filter(d => !['won','lost'].includes(d.deal_status)) ?? []
  const pipelineValue = open.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const overdue = invoices.data?.filter(d => d.status === 'overdue') ?? []

  const context = `
Last 30 days business snapshot:
- Deals: ${won.length} won, ${lost.length} lost, ${open.length} open (pipeline value: ₹${pipelineValue.toLocaleString()})
- Win rate: ${deals.data?.length ? ((won.length / deals.data.length) * 100).toFixed(1) : 0}%
- New leads: ${leads.data?.length ?? 0} (sources: ${[...new Set(leads.data?.map(l => l.lead_source))].filter(Boolean).join(', ') || 'N/A'})
- Lead statuses: ${JSON.stringify(leads.data?.reduce((a: Record<string, number>, l) => { a[l.lead_status] = (a[l.lead_status] ?? 0) + 1; return a }, {}))}
- Invoices: ${invoices.data?.length ?? 0} total, ${overdue.length} overdue
- Support tickets: ${tickets.data?.length ?? 0} total, ${tickets.data?.filter(t => t.priority === 'critical').length ?? 0} critical
`.trim()

  const provider = await getProviderForFeature('ai_insights')
  const adapter = provider === 'gemini' ? GeminiAdapter : OpenAIAdapter

  const response = await adapter.generate({
    systemPrompt: `You are Imperial Intelligence, a senior sales analyst for Imperial CRM. Provide strategic insights based on CRM data. Be direct, specific, and actionable. Use bullet points. Focus on what needs immediate attention and growth opportunities.`,
    prompt: `Analyze this 30-day business snapshot and provide strategic sales insights:\n${context}\n\nProvide: 1) Top 3 things going well, 2) Top 3 risks/concerns, 3) Top 3 recommended actions this week.`,
    maxTokens: 700,
    temperature: 0.4,
  })

  await consumeCredits(orgId, 'ai_insights', 2, `insights-${Date.now()}`, userId)
  await supabaseAdmin.from('crm_ai_logs').insert({
    org_id: orgId, user_id: userId, feature: 'ai_insights',
    provider, total_tokens: response.tokensUsed ?? 0, credits_used: 2,
  })

  return NextResponse.json({ insights: response.text, provider, dataSnapshot: { won: won.length, lost: lost.length, open: open.length, pipelineValue } })
}
