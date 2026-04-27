import OpenAI from 'openai'
import type { AIProviderAdapter, AIRequest, AIResponse } from './provider'

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  return new OpenAI({ apiKey })
}

export const OpenAIAdapter: AIProviderAdapter = {
  async generate(request: AIRequest): Promise<AIResponse> {
    const client = getClient()

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    messages.push({ role: 'user', content: request.prompt })

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    })

    const text = completion.choices[0]?.message?.content ?? ''
    const tokensUsed = completion.usage?.total_tokens

    return { text, provider: 'openai', tokensUsed }
  },
}
