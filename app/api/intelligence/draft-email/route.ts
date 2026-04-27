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

  const gate = await checkFeature(orgId, 'ai_draft_email', 1)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason ?? 'Insufficient AI credits' }, { status: 402 })

  const { purpose, contact_id, deal_id, tone = 'professional', extra_context = '' } = await req.json()
  if (!purpose) return NextResponse.json({ error: 'purpose is required' }, { status: 400 })

  let recipientInfo = ''
  if (contact_id) {
    const { data } = await supabaseAdmin.from('crm_contacts')
      .select(`first_name, last_name, job_title, crm_accounts(name)`)
      .eq('id', contact_id).eq('org_id', orgId).single()
    if (data) {
      const d = data as Record<string, unknown>
      const account = d.crm_accounts as { name: string } | null
      recipientInfo = `Recipient: ${d.first_name} ${d.last_name}, Title: ${d.job_title ?? 'N/A'}, Company: ${account?.name ?? 'N/A'}`
    }
  }
  if (deal_id) {
    const { data } = await supabaseAdmin.from('crm_deals')
      .select(`title, value, currency, crm_pipeline_stages(name)`)
      .eq('id', deal_id).eq('org_id', orgId).single()
    if (data) {
      const d = data as Record<string, unknown>
      const stage = d.crm_pipeline_stages as { name: string } | null
      recipientInfo += ` | Deal: ${d.title}, Value: ${d.currency} ${d.value}, Stage: ${stage?.name ?? 'N/A'}`
    }
  }

  const provider = await getProviderForFeature('ai_draft_email')
  const adapter = provider === 'gemini' ? GeminiAdapter : OpenAIAdapter

  const response = await adapter.generate({
    systemPrompt: `You are Imperial Intelligence, an expert sales email writer for Imperial CRM. Write professional, personalized, concise emails. Always include Subject:, Body:, and CTA: sections. Tone should be ${tone}.`,
    prompt: `Draft a ${tone} sales email for this purpose: "${purpose}"\n${recipientInfo ? `Context: ${recipientInfo}` : ''}\n${extra_context ? `Additional context: ${extra_context}` : ''}`,
    maxTokens: 600,
    temperature: 0.7,
  })

  await consumeCredits(orgId, 'ai_draft_email', 1, `draft-${Date.now()}`, userId)
  await supabaseAdmin.from('crm_ai_logs').insert({
    org_id: orgId, user_id: userId, feature: 'ai_draft_email',
    provider, total_tokens: response.tokensUsed ?? 0, credits_used: 1,
  })

  return NextResponse.json({ draft: response.text, provider })
}
