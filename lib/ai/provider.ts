import { supabaseAdmin } from '../supabase'

export type AIProvider = 'openai' | 'gemini'

export interface AIRequest {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface AIResponse {
  text: string
  provider: AIProvider
  tokensUsed?: number
}

export interface AIProviderAdapter {
  generate(request: AIRequest): Promise<AIResponse>
}

export async function getProviderForFeature(featureKey: string): Promise<AIProvider> {
  const { data } = await supabaseAdmin
    .from('feature_catalog')
    .select('preferred_provider')
    .eq('feature_key', featureKey)
    .single()

  return (data?.preferred_provider as AIProvider) ?? 'openai'
}
