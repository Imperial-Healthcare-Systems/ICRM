import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { checkFeature, consumeCredits } from '@/lib/feature-gate'
import { getProviderForFeature } from '@/lib/ai/provider'
import { OpenAIAdapter } from '@/lib/ai/openai'
import { GeminiAdapter } from '@/lib/ai/gemini'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error

  const { orgId, id: userId } = session!.user
  const { id } = await params

  const gate = await checkFeature(orgId, 'ai_lead_scoring', 1)
  if (!gate.allowed) return NextResponse.json({ error: gate.message }, { status: 402 })

  const { data: lead } = await supabaseAdmin
    .from('crm_leads')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  const prompt = `
You are a CRM lead scoring AI. Score this lead from 0–100 based on conversion likelihood.

Lead data:
- Name: ${lead.first_name} ${lead.last_name ?? ''}
- Company: ${lead.company ?? 'Unknown'}
- Job Title: ${lead.job_title ?? 'Unknown'}
- Source: ${lead.lead_source ?? 'Unknown'}
- Status: ${lead.lead_status}
- Email: ${lead.email ? 'provided' : 'missing'}
- Phone: ${lead.phone ? 'provided' : 'missing'}
- Notes: ${lead.notes ?? 'none'}

Respond with ONLY a JSON object: {"score": <number 0-100>, "reason": "<1 sentence>"}
`.trim()

  const provider = await getProviderForFeature('ai_lead_scoring')
  const adapter = provider === 'gemini' ? GeminiAdapter : OpenAIAdapter

  let responseText = ''
  try {
    const result = await adapter.generate({ prompt, maxTokens: 100, temperature: 0.3 })
    responseText = result.text.trim()
  } catch {
    return NextResponse.json({ error: 'AI scoring failed. Try again.' }, { status: 500 })
  }

  let score = 50
  let reason = ''
  try {
    const cleaned = responseText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    score = Math.min(100, Math.max(0, Number(parsed.score) || 50))
    reason = parsed.reason ?? ''
  } catch {
    const match = responseText.match(/\d+/)
    score = match ? Math.min(100, Math.max(0, Number(match[0]))) : 50
  }

  await supabaseAdmin
    .from('crm_leads')
    .update({ ai_score: score, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)

  await consumeCredits(orgId, 'ai_lead_scoring', gate.creditsToCharge, id, userId)

  return NextResponse.json({ score, reason })
}
