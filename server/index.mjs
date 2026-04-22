import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import aiRegistry from './ai-models.json' with { type: 'json' }
import translationRegistry from './translation-models.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvFile(resolve(__dirname, '.env'))

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 3
const MAX_SOURCE_CHARS = 24_000
const MAX_ITEMS = 80
const MAX_TOTAL_CHARS = 16_000
const PORT = Number(process.env.PORT || 3000)

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const SUMMARY_SYSTEM_PROMPT = [
  'You only generate concise article summaries.',
  'Summarize the provided markdown faithfully.',
  'Do not add extra background, warnings, or commentary.',
  'Return only the summary body without title, bullets, code fences, or quotes.',
  'Keep the summary concise and readable.',
].join('\n')

const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional website translator.',
  'Translate each input string into the requested target language.',
  'Preserve the original meaning, tone, and reading flow.',
  'Do not add explanations, notes, markdown fences, or extra fields.',
  'Return strict JSON only in the form {"translations":["..."]}.',
  'The translations array must have exactly the same number of items and the same order as the input array.',
].join('\n')

function json(res, status, body, origin = '*') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  })
  res.end(JSON.stringify(body))
}

function getOrigin(req) {
  return req.headers.origin || '*'
}

function extractResponseText(payload) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanSummaryOutput(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^```[\s\S]*?```$/g, '')
    .replace(/^\s*(摘要[:：]?\s*)/i, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildSummaryPrompt(title, content) {
  const source = content.length > MAX_SOURCE_CHARS ? content.slice(0, MAX_SOURCE_CHARS) : content
  return [
    `Title: ${title}`,
    'Return only the summary body.',
    'Do not include labels like "Summary".',
    'Here is the markdown article:',
    source,
  ].join('\n\n')
}

function buildTranslatePrompt(sourceLanguage, targetLanguage, items) {
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

function parseTranslations(raw) {
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

  return parsed.translations.map((item) => String(item ?? ''))
}

function findAiModelById(id) {
  if (!id) return undefined
  return (aiRegistry.models || []).find((model) => model.id === id)
}

function findTranslationModelById(id) {
  if (!id) return undefined
  return (translationRegistry.models || []).find((model) => model.id === id)
}

async function requestChatCompletion({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  timeoutMs,
  retries,
  temperature,
  maxTokens,
}) {
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`
        throw new Error(message)
      }

      const content = extractResponseText(payload)
      if (!content) {
        throw new Error('No model content returned')
      }

      return content
    } catch (error) {
      if (attempt >= retries) throw error
      await sleep(Math.min(1000 * attempt, 3000))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Request failed')
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 2_000_000) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

async function handleSummary(req, res, origin) {
  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL
  const apiKey = process.env.OPENAI_API_KEY
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const retries = Number(process.env.OPENAI_RETRIES || DEFAULT_RETRIES)

  if (!apiKey) {
    return json(res, 500, { error: 'Missing OPENAI_API_KEY' }, origin)
  }

  let payload = {}

  try {
    payload = await readJsonBody(req)
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' }, origin)
  }

  const title = String(payload.title || '').trim()
  const content = String(payload.content || '').trim()
  const aiModel = String(payload.aiModel || '').trim()

  if (!title) return json(res, 400, { error: 'Missing title' }, origin)
  if (!content) return json(res, 400, { error: 'Missing content' }, origin)
  if (!aiModel) return json(res, 400, { error: 'Missing aiModel' }, origin)

  const model = findAiModelById(aiModel)
  if (!model) {
    return json(res, 400, { error: `Unsupported aiModel: ${aiModel}` }, origin)
  }

  if (model.capabilities && !model.capabilities.includes('text')) {
    return json(res, 400, { error: `Model ${aiModel} does not support text generation` }, origin)
  }

  try {
    const rawSummary = await requestChatCompletion({
      baseUrl,
      apiKey,
      model: model.id,
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt: buildSummaryPrompt(title, content),
      timeoutMs,
      retries,
      temperature: 0.2,
      maxTokens: 220,
    })

    return json(res, 200, {
      summary: cleanSummaryOutput(rawSummary),
      model: model.id,
      modelName: model.name,
    }, origin)
  } catch (error) {
    console.error('[server][ai-summary] request failed:', error)
    return json(res, 502, {
      error: error instanceof Error ? error.message : 'Failed to generate summary',
    }, origin)
  }
}

async function handleTranslate(req, res, origin) {
  const baseUrl = process.env.AI_TRANSLATE_BASE_URL || DEFAULT_BASE_URL
  const apiKey = process.env.AI_TRANSLATE_API_KEY
  const timeoutMs = Number(process.env.AI_TRANSLATE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const retries = Number(process.env.AI_TRANSLATE_RETRIES || DEFAULT_RETRIES)

  if (!apiKey) {
    return json(res, 500, { error: 'Missing AI_TRANSLATE_API_KEY' }, origin)
  }

  let payload = {}

  try {
    payload = await readJsonBody(req)
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' }, origin)
  }

  const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item ?? '')) : []
  const sourceLanguage = String(payload.sourceLanguage || 'auto').trim() || 'auto'
  const targetLanguage = String(payload.targetLanguage || '').trim()
  const aiModel = String(payload.aiModel || '').trim()

  if (!targetLanguage) return json(res, 400, { error: 'Missing targetLanguage' }, origin)
  if (!aiModel) return json(res, 400, { error: 'Missing aiModel' }, origin)
  if (items.length === 0) return json(res, 400, { error: 'Missing items' }, origin)
  if (items.length > MAX_ITEMS) {
    return json(res, 400, { error: `Too many items. Maximum is ${MAX_ITEMS}` }, origin)
  }

  const totalChars = items.reduce((sum, item) => sum + item.length, 0)
  if (totalChars > MAX_TOTAL_CHARS) {
    return json(res, 400, { error: `Input too large. Maximum is ${MAX_TOTAL_CHARS} characters` }, origin)
  }

  const model = findTranslationModelById(aiModel)
  if (!model) {
    return json(res, 400, { error: `Unsupported aiModel: ${aiModel}` }, origin)
  }

  if (model.capabilities && !model.capabilities.includes('text')) {
    return json(res, 400, { error: `Model ${aiModel} does not support text generation` }, origin)
  }

  try {
    const rawTranslations = await requestChatCompletion({
      baseUrl,
      apiKey,
      model: model.id,
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
      userPrompt: buildTranslatePrompt(sourceLanguage, targetLanguage, items),
      timeoutMs,
      retries,
      temperature: 0.1,
      maxTokens: 4000,
    })

    const translations = parseTranslations(rawTranslations)
    if (translations.length !== items.length) {
      return json(res, 502, {
        error: `Model returned ${translations.length} items, expected ${items.length}`,
      }, origin)
    }

    return json(res, 200, {
      translations,
      model: model.id,
      modelName: model.name,
    }, origin)
  } catch (error) {
    console.error('[server][ai-translate] request failed:', error)
    return json(res, 502, {
      error: error instanceof Error ? error.message : 'Failed to translate content',
    }, origin)
  }
}

const server = createServer(async (req, res) => {
  const origin = getOrigin(req)
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true }, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/summary') {
    return handleSummary(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/translate') {
    return handleTranslate(req, res, origin)
  }

  return json(res, 404, { error: 'Not found' }, origin)
})

server.listen(PORT, () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`)
})
