import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProviderAdapter, AIRequest, AIResponse } from './provider'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.')
  return new GoogleGenerativeAI(apiKey)
}

export const GeminiAdapter: AIProviderAdapter = {
  async generate(request: AIRequest): Promise<AIResponse> {
    const genAI = getClient()
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      },
    })

    const parts: string[] = []

    if (request.systemPrompt) {
      parts.push(request.systemPrompt)
    }

    parts.push(request.prompt)

    const result = await model.generateContent(parts.join('\n\n'))
    const text = result.response.text()

    return { text, provider: 'gemini' }
  },
}
