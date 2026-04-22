import type { APIRoute } from 'astro'
import { findTranslationModelById } from '@/lib/translation-models'

export const prerender = false

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 3
const MAX_ITEMS = 80
const MAX_TOTAL_CHARS = 16_000

const SYSTEM_PROMPT = [
  'You are a professional website translator.',
  'Translate each input string into the requested target language.',
  'Preserve the original meaning, tone, and reading flow.',
  'Do not add explanations, notes, markdown fences, or extra fields.',
  'Return strict JSON only in the form {"translations":["..."]}.',
  'The translations array must have exactly the same number of items and the same order as the input array.',
].join('\n')

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function extractResponseText(payload: any) {
  const firstChoice = payload?.choices?.[0]
  const messageContent = firstChoice?.message?.content

  if (typeof messageContent === 'string') return messageContent
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join('')
      .trim()
  }
  if (typeof firstChoice?.text === 'string') return firstChoice.text
  return ''
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildUserPrompt(sourceLanguage: string, targetLanguage: string, items: string[]) {
  return JSON.stringify({
    sourceLanguage,
    targetLanguage,
    instructions: [
      'Translate every string.',
      'Keep the same item order.',
      'Return JSON only.',
    ],
    items,
  })
}

function parseTranslations(raw: string) {
  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const match = cleaned.match(/\{[\s\S]*\}/)
  const candidate = match ? match[0] : cleaned
  const parsed = JSON.parse(candidate)

  if (!Array.isArray(parsed?.translations)) {
    throw new Error('Model response did not include a translations array')
  }

  return parsed.translations.map((item: unknown) => String(item ?? ''))
}

async function requestTranslations(baseUrl: string, apiKey: string, model: string, prompt: string, timeoutMs: number, retries: number) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
          stream: false,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`
        throw new Error(message)
      }

      const content = extractResponseText(payload)
      if (!content) throw new Error('No translation content returned by model')
      return parseTranslations(content)
    } catch (error) {
      if (attempt >= retries) throw error
      await sleep(Math.min(1000 * attempt, 3000))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Failed to translate content')
}

export const POST: APIRoute = async ({ request }) => {
  const baseUrl = process.env.AI_TRANSLATE_BASE_URL || DEFAULT_BASE_URL
  const apiKey = process.env.AI_TRANSLATE_API_KEY
  const timeoutMs = Number(process.env.AI_TRANSLATE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const retries = Number(process.env.AI_TRANSLATE_RETRIES || DEFAULT_RETRIES)

  if (!apiKey) {
    return json(500, { error: 'Missing AI_TRANSLATE_API_KEY' })
  }

  let payload: {
    items?: string[]
    sourceLanguage?: string
    targetLanguage?: string
    aiModel?: string
  } = {}

  try {
    payload = await request.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item ?? '')) : []
  const sourceLanguage = payload.sourceLanguage?.trim() || 'auto'
  const targetLanguage = payload.targetLanguage?.trim()
  const aiModel = payload.aiModel?.trim()

  if (!targetLanguage) return json(400, { error: 'Missing targetLanguage' })
  if (!aiModel) return json(400, { error: 'Missing aiModel' })
  if (items.length === 0) return json(400, { error: 'Missing items' })
  if (items.length > MAX_ITEMS) return json(400, { error: `Too many items. Maximum is ${MAX_ITEMS}` })

  const totalChars = items.reduce((sum, item) => sum + item.length, 0)
  if (totalChars > MAX_TOTAL_CHARS) {
    return json(400, { error: `Input too large. Maximum is ${MAX_TOTAL_CHARS} characters` })
  }

  const model = await findTranslationModelById(aiModel)
  if (!model) {
    return json(400, { error: `Unsupported aiModel: ${aiModel}` })
  }

  if (model.capabilities && !model.capabilities.includes('text')) {
    return json(400, { error: `Model ${aiModel} does not support text generation` })
  }

  try {
    const translations = await requestTranslations(
      baseUrl,
      apiKey,
      model.id,
      buildUserPrompt(sourceLanguage, targetLanguage, items),
      timeoutMs,
      retries,
    )

    if (translations.length !== items.length) {
      return json(502, { error: `Model returned ${translations.length} items, expected ${items.length}` })
    }

    return json(200, {
      translations,
      model: model.id,
      modelName: model.name,
    })
  } catch (error) {
    console.error('[ai-translate] request failed:', error)
    return json(502, {
      error: error instanceof Error ? error.message : 'Failed to translate content',
    })
  }
}
