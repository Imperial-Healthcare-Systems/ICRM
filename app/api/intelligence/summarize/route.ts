import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { checkFeature, consumeCredits } from '@/lib/feature-gate'
import { getProviderForFeature } from '@/lib/ai/provider'
import { OpenAIAdapter } from '@/lib/ai/openai'
import { GeminiAdapter } from '@/lib/ai/gemini'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { type, id } = await req.json()
  if (!type || !id) return NextResponse.json({ error: 'type and id are required' }, { status: 400 })

  const gate = await checkFeature(orgId, 'ai_summarize', 1)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason ?? 'Insufficient AI credits' }, { status: 402 })

  let context = ''

  if (type === 'deal') {
    const { data } = await supabaseAdmin.from('crm_deals')
      .select(`title, value, status, probability, notes, currency,
        crm_accounts(name), crm_contacts(first_name,last_name),
        crm_pipeline_stages(name)`)
      .eq('id', id).eq('org_id', orgId).single()
    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    const account = d.crm_accounts as { name: string } | null
    const contact = d.crm_contacts as { first_name: string; last_name: string } | null
    const stage = d.crm_pipeline_stages as { name: string } | null
    context = `Deal: ${d.title}, Value: ${d.currency} ${d.value}, Stage: ${stage?.name ?? 'Unknown'}, Status: ${d.status}, Probability: ${d.probability}%, Account: ${account?.name ?? 'N/A'}, Contact: ${contact ? `${contact.first_name} ${contact.last_name}` : 'N/A'}, Notes: ${d.notes ?? 'None'}`
  } else if (type === 'contact') {
    const { data } = await supabaseAdmin.from('crm_contacts')
      .select(`first_name, last_name, email, phone, job_title, notes, crm_accounts(name)`)
      .eq('id', id).eq('org_id', orgId).single()
    if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    const c = data as Record<string, unknown>
    const account = c.crm_accounts as { name: string } | null
    context = `Contact: ${c.first_name} ${c.last_name}, Title: ${c.job_title ?? 'N/A'}, Email: ${c.email}, Phone: ${c.phone ?? 'N/A'}, Account: ${account?.name ?? 'N/A'}, Notes: ${c.notes ?? 'None'}`
  } else if (type === 'account') {
    const { data } = await supabaseAdmin.from('crm_accounts')
      .select(`name, industry, website, employee_count, annual_revenue, notes`)
      .eq('id', id).eq('org_id', orgId).single()
    if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    const a = data as Record<string, unknown>
    context = `Account: ${a.name}, Industry: ${a.industry ?? 'N/A'}, Website: ${a.website ?? 'N/A'}, Employees: ${a.employee_count ?? 'N/A'}, Annual Revenue: ${a.annual_revenue ?? 'N/A'}, Notes: ${a.notes ?? 'None'}`
  } else {
    return NextResponse.json({ error: 'type must be deal, contact, or account' }, { status: 400 })
  }

  const provider = await getProviderForFeature('ai_summarize')
  const adapter = provider === 'gemini' ? GeminiAdapter : OpenAIAdapter

  const response = await adapter.generate({
    systemPrompt: `You are Imperial Intelligence, an AI assistant for Imperial CRM. Provide concise, actionable sales insights. Format your response in 3 short sections: Key Facts, Opportunities, and Recommended Next Steps. Be specific and brief.`,
    prompt: `Analyze this ${type} and provide a sales summary:\n${context}`,
    maxTokens: 512,
    temperature: 0.5,
  })

  await consumeCredits(orgId, 'ai_summarize', 1, id, userId)
  await supabaseAdmin.from('crm_ai_logs').insert({
    org_id: orgId, user_id: userId, feature: 'ai_summarize',
    provider, total_tokens: response.tokensUsed ?? 0, credits_used: 1,
  })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'ai_summarize', resource_type: type, resource_id: id })

  return NextResponse.json({ summary: response.text, provider })
}
