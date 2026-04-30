import { readFileSync, watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { t } from '../core/locales.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createConfigLoader(filename) {
  const filePath = resolve(__dirname, '../../config', filename)
  let cache = JSON.parse(readFileSync(filePath, 'utf8'))

  watch(filePath, () => {
    try { cache = JSON.parse(readFileSync(filePath, 'utf8')) } catch { /* 解析失败时保留旧缓存 */ }
  })

  return () => cache
}

const getAiRegistry = createConfigLoader('ai-models.json')
const getTranslationRegistry = createConfigLoader('translation-models.json')

const MAX_SOURCE_CHARS = 24_000
const MAX_ITEMS = 80
const MAX_TOTAL_CHARS = 16_000

const SUMMARY_SYSTEM_PROMPT = [
  'You only generate concise article summaries.',
  'Summarize the provided markdown faithfully.',
  'Do not add extra background, warnings, or commentary.',
  'Return only the summary body without title, bullets, code fences, or quotes.',
  'Keep the summary concise and readable.',
].join('\n')

const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional website translator.',
  'Translate each numbered item into the requested target language.',
  'Preserve the original meaning, tone, formatting, and code.',
  'Do not add explanations, notes, markdown fences, or extra fields.',
  'Return the translations as a numbered list: 1. xxx, 2. xxx, etc.',
  'Keep the exact same order and same number of items.',
].join('\n')

const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'by',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'as', 'at', 'or',
  'not', 'but', 'can', 'will', 'would', 'should', 'could', 'page', 'site',
  'translation', 'translate', 'hello', 'world', 'test',
])

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
    .replace(/^\s*(summary|摘要)\s*[:：]?\s*/i, '')
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

function getLanguageLabel(language) {
  const normalized = String(language || '').trim().toLowerCase()
  const labels = {
    auto: 'Auto Detect',
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    ru: 'Russian',
    zh: 'Chinese',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
  }

  return labels[normalized] || language
}

function buildTranslatePrompt(sourceLanguage, targetLanguage, items) {
  const numbered = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return [
    `Source language: ${getLanguageLabel(sourceLanguage)}`,
    `Target language: ${getLanguageLabel(targetLanguage)}`,
    `Translate each numbered item below into ${getLanguageLabel(targetLanguage)}.`,
    'Return the translations as a numbered list, keeping the same order.',
    'Do not include the original items or any other text.',
    '',
    numbered,
  ].join('\n')
}

function buildTranslateRetryPrompt(sourceLanguage, targetLanguage, items) {
  const numbered = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return [
    `The previous attempt did not reliably produce ${getLanguageLabel(targetLanguage)}.`,
    `Source language: ${getLanguageLabel(sourceLanguage)}`,
    `Target language: ${getLanguageLabel(targetLanguage)} — do NOT translate into any other language.`,
    'Translate each numbered item below.',
    'Return only the translations as a numbered list.',
    '',
    numbered,
  ].join('\n')
}

function buildTranslateCountRetryPrompt(sourceLanguage, targetLanguage, items, expectedCount) {
  const numbered = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return [
    `Source language: ${getLanguageLabel(sourceLanguage)}`,
    `Target language: ${getLanguageLabel(targetLanguage)}`,
    `CRITICAL: There are exactly ${expectedCount} numbered items below.`,
    `You MUST return exactly ${expectedCount} translations, no more, no less.`,
    'Translate each numbered item and return as a numbered list.',
    'Count your translations carefully before responding.',
    '',
    numbered,
  ].join('\n')
}

function parseTranslations(raw) {
  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .trim()
  const lines = cleaned.split('\n')
  const results = []
  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)、:]\s*(.+)/)
    if (match) {
      results.push(match[1].trim())
    }
  }
  if (results.length > 0) return results
  // 降级：模型可能用纯换行返回
  const nonEmpty = cleaned.split('\n').map((s) => s.trim()).filter(Boolean)
  return nonEmpty.length > 0 ? nonEmpty : [cleaned]
}

function containsExpectedScript(language, text) {
  const normalized = String(language || '').trim().toLowerCase()

  if (normalized === 'ja') return /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/u.test(text)
  if (normalized === 'ko') return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text)
  if (normalized === 'ru') return /[\u0400-\u04ff]/u.test(text)
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-tw') {
    return /[\u4e00-\u9fff]/u.test(text)
  }

  return false
}

function isLikelyEnglishText(text) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return false

  const latinWords = normalized.match(/[a-z']+/g) || []
  if (latinWords.length < 2) return false

  const stopwordHits = latinWords.filter((word) => ENGLISH_STOPWORDS.has(word)).length
  const nonLatinChars = (normalized.match(/[^\x00-\x7f]/g) || []).length

  return stopwordHits >= 2 && nonLatinChars <= Math.max(2, normalized.length * 0.15)
}

function shouldRetryTranslations(targetLanguage, translations) {
  const normalized = String(targetLanguage || '').trim().toLowerCase()
  if (!normalized || normalized === 'en') return false

  const nonEmptyTranslations = translations
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  if (nonEmptyTranslations.length === 0) return false

  const suspiciousCount = nonEmptyTranslations.filter((text) => {
    if (containsExpectedScript(normalized, text)) return false
    return isLikelyEnglishText(text)
  }).length

  return suspiciousCount / nonEmptyTranslations.length >= 0.6
}

function findAiModelById(id) {
  if (!id) return undefined
  return (getAiRegistry().models || []).find((model) => model.id === id)
}

function findTranslationModelById(id) {
  if (!id) return undefined
  return (getTranslationRegistry().models || []).find((model) => model.id === id)
}

export function createAiHandlers({
  log,
  json,
  readJsonBody,
  driveCrypto,
  defaultBaseUrl,
  defaultTimeoutMs,
  defaultRetries,
}) {
  // ── AI 功能开关（环境变量控制，默认启用） ──
  const summaryEnabled = (process.env.AI_SUMMARY_ENABLED || 'true') !== 'false'
  const translateEnabled = (process.env.AI_TRANSLATE_ENABLED || 'true') !== 'false'

  function secureJson(res, status, aesKey, body, origin) {
    return json(res, status, driveCrypto.encryptResponse(aesKey, body), origin)
  }

  async function requestChatCompletion({
    requestId,
    route,
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
        log('INFO', t('ai_upstream_started'), {
          requestId,
          route,
          attempt,
          retries,
          model,
          endpoint,
        })

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
          const error = new Error(message)
          error.status = response.status
          error.payload = payload
          throw error
        }

        const content = extractResponseText(payload)
        if (!content) {
          throw new Error('No model content returned')
        }

        log('INFO', t('ai_upstream_completed'), {
          requestId,
          route,
          attempt,
          model,
          status: response.status,
        })

        return content
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log(attempt >= retries ? 'ERROR' : 'WARN', t('ai_upstream_failed'), {
          requestId,
          route,
          attempt,
          retries,
          model,
          status: error?.status,
          error: errorMessage,
        })
        if (attempt >= retries) throw error
        await sleep(Math.min(1000 * attempt, 3000))
      } finally {
        clearTimeout(timer)
      }
    }

    throw new Error('Request failed')
  }

  async function runSummaryPayload(requestId, payload) {
    if (!summaryEnabled) {
      log('INFO', t('ai_summary_disabled'), { requestId })
      return { status: 403, body: { error: 'AI 摘要功能已禁用 / AI summary is disabled' } }
    }

    const baseUrl = process.env.OPENAI_BASE_URL || defaultBaseUrl
    const apiKey = process.env.OPENAI_API_KEY
    const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || defaultTimeoutMs)
    const retries = Number(process.env.OPENAI_RETRIES || defaultRetries)

    if (!apiKey) {
      log('ERROR', t('ai_summary_missing_key'), { requestId })
      return { status: 500, body: { error: 'Missing OPENAI_API_KEY' } }
    }

    const title = String(payload.title || '').trim()
    const content = String(payload.content || '').trim()
    const aiModel = String(payload.aiModel || '').trim()

    if (!title) {
      log('WARN', t('ai_summary_missing_title'), { requestId })
      return { status: 400, body: { error: 'Missing title' } }
    }
    if (!content) {
      log('WARN', t('ai_summary_missing_content'), { requestId })
      return { status: 400, body: { error: 'Missing content' } }
    }
    if (!aiModel) {
      log('WARN', t('ai_summary_missing_model'), { requestId })
      return { status: 400, body: { error: 'Missing aiModel' } }
    }

    const model = findAiModelById(aiModel)
    if (!model) {
      log('WARN', t('ai_summary_unsupported_model'), { requestId, aiModel })
      return { status: 400, body: { error: `Unsupported aiModel: ${aiModel}` } }
    }

    if (model.capabilities && !model.capabilities.includes('text')) {
      log('WARN', t('ai_summary_no_text_capability'), { requestId, aiModel })
      return { status: 400, body: { error: `Model ${aiModel} does not support text generation` } }
    }

    try {
      const rawSummary = await requestChatCompletion({
        requestId,
        route: '/api/ai/summary',
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

      log('INFO', t('ai_summary_generated'), {
        requestId,
        aiModel: model.id,
        titleLength: title.length,
        contentLength: content.length,
      })

      return {
        status: 200,
        body: {
          summary: cleanSummaryOutput(rawSummary),
          model: model.id,
          modelName: model.name,
        },
      }
    } catch (error) {
      log('ERROR', t('ai_summary_failed'), {
        requestId,
        aiModel: model.id,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return {
        status: 502,
        body: {
          error: error instanceof Error ? error.message : 'Failed to generate summary',
        },
      }
    }
  }

  async function runTranslatePayload(requestId, payload) {
    if (!translateEnabled) {
      log('INFO', t('ai_translate_disabled'), { requestId })
      return { status: 403, body: { error: 'AI 翻译功能已禁用 / AI translation is disabled' } }
    }

    const baseUrl = process.env.AI_TRANSLATE_BASE_URL || defaultBaseUrl
    const apiKey = process.env.AI_TRANSLATE_API_KEY
    const timeoutMs = Math.min(Number(process.env.AI_TRANSLATE_TIMEOUT_MS || defaultTimeoutMs), 25_000)
    const retries = Math.min(Number(process.env.AI_TRANSLATE_RETRIES || defaultRetries), 1)

    if (!apiKey) {
      log('ERROR', t('ai_translate_missing_key'), { requestId })
      return { status: 500, body: { error: 'Missing AI_TRANSLATE_API_KEY' } }
    }

    const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item ?? '')) : []
    const sourceLanguage = String(payload.sourceLanguage || 'auto').trim() || 'auto'
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const aiModel = String(payload.aiModel || '').trim()

    if (!targetLanguage) {
      log('WARN', t('ai_translate_missing_target'), { requestId })
      return { status: 400, body: { error: 'Missing targetLanguage' } }
    }
    if (!aiModel) {
      log('WARN', t('ai_translate_missing_model'), { requestId })
      return { status: 400, body: { error: 'Missing aiModel' } }
    }
    if (items.length === 0) {
      log('WARN', t('ai_translate_missing_items'), { requestId })
      return { status: 400, body: { error: 'Missing items' } }
    }
    if (items.length > MAX_ITEMS) {
      log('WARN', t('ai_translate_too_many_items'), { requestId, items: items.length })
      return { status: 400, body: { error: `Too many items. Maximum is ${MAX_ITEMS}` } }
    }

    const totalChars = items.reduce((sum, item) => sum + item.length, 0)
    if (totalChars > MAX_TOTAL_CHARS) {
      log('WARN', t('ai_translate_input_too_large'), { requestId, totalChars })
      return { status: 400, body: { error: `Input too large. Maximum is ${MAX_TOTAL_CHARS} characters` } }
    }

    const model = findTranslationModelById(aiModel)
    if (!model) {
      log('WARN', t('ai_translate_unsupported_model'), { requestId, aiModel })
      return { status: 400, body: { error: `Unsupported aiModel: ${aiModel}` } }
    }

    if (model.capabilities && !model.capabilities.includes('text')) {
      log('WARN', t('ai_translate_no_text_capability'), { requestId, aiModel })
      return { status: 400, body: { error: `Model ${aiModel} does not support text generation` } }
    }

    try {
      const rawTranslations = await requestChatCompletion({
        requestId,
        route: '/api/ai/translate',
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

      let translations = parseTranslations(rawTranslations)

      if (shouldRetryTranslations(targetLanguage, translations)) {
        log('WARN', t('ai_translate_wrong_lang_retry'), {
          requestId,
          aiModel: model.id,
          targetLanguage,
        })

        const retryRaw = await requestChatCompletion({
          requestId,
          route: '/api/ai/translate',
          baseUrl,
          apiKey,
          model: model.id,
          systemPrompt: TRANSLATE_SYSTEM_PROMPT,
          userPrompt: buildTranslateRetryPrompt(sourceLanguage, targetLanguage, items),
          timeoutMs,
          retries,
          temperature: 0,
          maxTokens: 4000,
        })

        translations = parseTranslations(retryRaw)
      }

      if (translations.length !== items.length) {
        log('WARN', t('ai_translate_count_mismatch_retry'), {
          requestId,
          aiModel: model.id,
          expected: items.length,
          actual: translations.length,
        })

        const previousTranslations = translations
        const countRetryRaw = await requestChatCompletion({
          requestId,
          route: '/api/ai/translate',
          baseUrl,
          apiKey,
          model: model.id,
          systemPrompt: TRANSLATE_SYSTEM_PROMPT,
          userPrompt: buildTranslateCountRetryPrompt(sourceLanguage, targetLanguage, items, items.length),
          timeoutMs,
          retries: 1,
          temperature: 0,
          maxTokens: 4000,
        })
        const countRetryTranslations = parseTranslations(countRetryRaw)
        translations = countRetryTranslations.length >= previousTranslations.length
          ? countRetryTranslations
          : previousTranslations
      }

      if (translations.length !== items.length) {
        log('WARN', t('ai_translate_count_mismatch'), {
          requestId,
          aiModel: model.id,
          expected: items.length,
          actual: translations.length,
        })
        for (let i = translations.length; i < items.length; i += 1) {
          translations.push(items[i])
        }
      }

      log('INFO', t('ai_translate_generated'), {
        requestId,
        aiModel: model.id,
        items: items.length,
        totalChars,
        targetLanguage,
      })

      return {
        status: 200,
        body: {
          translations,
          model: model.id,
          modelName: model.name,
        },
      }
    } catch (error) {
      log('ERROR', t('ai_translate_failed'), {
        requestId,
        aiModel: model.id,
        items: items.length,
        targetLanguage,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return {
        status: 502,
        body: {
          error: error instanceof Error ? error.message : 'Failed to translate content',
        },
      }
    }
  }

  async function handleSecureAi(req, res, origin) {
    let secureRequest

    try {
      const envelope = await readJsonBody(req)
      secureRequest = driveCrypto.decryptEnvelope(envelope)
    } catch (error) {
      log('WARN', t('ai_encrypted_rejected'), {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid encrypted AI request' }, origin)
    }

    const action = String(secureRequest.payload?.action || '')
    const payload = secureRequest.payload?.payload && typeof secureRequest.payload.payload === 'object'
      ? secureRequest.payload.payload
      : {}
    const result = action === 'summary'
      ? await runSummaryPayload(req.requestId, payload)
      : action === 'translate'
        ? await runTranslatePayload(req.requestId, payload)
        : { status: 404, body: { error: 'Unknown secure AI action' } }

    return secureJson(res, result.status, secureRequest.aesKey, result.body, origin)
  }

  async function handleSummary(req, res, origin) {
    const requestId = req.requestId

    if (!summaryEnabled) {
      log('INFO', t('ai_summary_disabled'), { requestId })
      return json(res, 403, { error: 'AI 摘要功能已禁用 / AI summary is disabled' }, origin)
    }

    const baseUrl = process.env.OPENAI_BASE_URL || defaultBaseUrl
    const apiKey = process.env.OPENAI_API_KEY
    const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || defaultTimeoutMs)
    const retries = Number(process.env.OPENAI_RETRIES || defaultRetries)

    if (!apiKey) {
      log('ERROR', t('ai_summary_missing_key'), { requestId })
      return json(res, 500, { error: 'Missing OPENAI_API_KEY' }, origin)
    }

    let payload = {}

    try {
      payload = await readJsonBody(req)
    } catch (error) {
      log('WARN', t('ai_summary_invalid_body'), {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' }, origin)
    }

    const title = String(payload.title || '').trim()
    const content = String(payload.content || '').trim()
    const aiModel = String(payload.aiModel || '').trim()

    if (!title) {
      log('WARN', t('ai_summary_missing_title'), { requestId })
      return json(res, 400, { error: 'Missing title' }, origin)
    }
    if (!content) {
      log('WARN', t('ai_summary_missing_content'), { requestId })
      return json(res, 400, { error: 'Missing content' }, origin)
    }
    if (!aiModel) {
      log('WARN', t('ai_summary_missing_model'), { requestId })
      return json(res, 400, { error: 'Missing aiModel' }, origin)
    }

    const model = findAiModelById(aiModel)
    if (!model) {
      log('WARN', t('ai_summary_unsupported_model'), { requestId, aiModel })
      return json(res, 400, { error: `Unsupported aiModel: ${aiModel}` }, origin)
    }

    if (model.capabilities && !model.capabilities.includes('text')) {
      log('WARN', t('ai_summary_no_text_capability'), { requestId, aiModel })
      return json(res, 400, { error: `Model ${aiModel} does not support text generation` }, origin)
    }

    try {
      const rawSummary = await requestChatCompletion({
        requestId,
        route: '/api/ai/summary',
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

      log('INFO', t('ai_summary_generated'), {
        requestId,
        aiModel: model.id,
        titleLength: title.length,
        contentLength: content.length,
      })

      return json(res, 200, {
        summary: cleanSummaryOutput(rawSummary),
        model: model.id,
        modelName: model.name,
      }, origin)
    } catch (error) {
      log('ERROR', t('ai_summary_failed'), {
        requestId,
        aiModel: model.id,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, 502, {
        error: error instanceof Error ? error.message : 'Failed to generate summary',
      }, origin)
    }
  }

  async function handleTranslate(req, res, origin) {
    const requestId = req.requestId

    if (!translateEnabled) {
      log('INFO', t('ai_translate_disabled'), { requestId })
      return json(res, 403, { error: 'AI 翻译功能已禁用 / AI translation is disabled' }, origin)
    }

    const baseUrl = process.env.AI_TRANSLATE_BASE_URL || defaultBaseUrl
    const apiKey = process.env.AI_TRANSLATE_API_KEY
    const timeoutMs = Math.min(Number(process.env.AI_TRANSLATE_TIMEOUT_MS || defaultTimeoutMs), 25_000)
    const retries = Math.min(Number(process.env.AI_TRANSLATE_RETRIES || defaultRetries), 1)

    if (!apiKey) {
      log('ERROR', t('ai_translate_missing_key'), { requestId })
      return json(res, 500, { error: 'Missing AI_TRANSLATE_API_KEY' }, origin)
    }

    let payload = {}

    try {
      payload = await readJsonBody(req)
    } catch (error) {
      log('WARN', t('ai_translate_invalid_body'), {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' }, origin)
    }

    const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item ?? '')) : []
    const sourceLanguage = String(payload.sourceLanguage || 'auto').trim() || 'auto'
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const aiModel = String(payload.aiModel || '').trim()

    if (!targetLanguage) {
      log('WARN', t('ai_translate_missing_target'), { requestId })
      return json(res, 400, { error: 'Missing targetLanguage' }, origin)
    }
    if (!aiModel) {
      log('WARN', t('ai_translate_missing_model'), { requestId })
      return json(res, 400, { error: 'Missing aiModel' }, origin)
    }
    if (items.length === 0) {
      log('WARN', t('ai_translate_missing_items'), { requestId })
      return json(res, 400, { error: 'Missing items' }, origin)
    }
    if (items.length > MAX_ITEMS) {
      log('WARN', t('ai_translate_too_many_items'), { requestId, items: items.length })
      return json(res, 400, { error: `Too many items. Maximum is ${MAX_ITEMS}` }, origin)
    }

    const totalChars = items.reduce((sum, item) => sum + item.length, 0)
    if (totalChars > MAX_TOTAL_CHARS) {
      log('WARN', t('ai_translate_input_too_large'), { requestId, totalChars })
      return json(res, 400, { error: `Input too large. Maximum is ${MAX_TOTAL_CHARS} characters` }, origin)
    }

    const model = findTranslationModelById(aiModel)
    if (!model) {
      log('WARN', t('ai_translate_unsupported_model'), { requestId, aiModel })
      return json(res, 400, { error: `Unsupported aiModel: ${aiModel}` }, origin)
    }

    if (model.capabilities && !model.capabilities.includes('text')) {
      log('WARN', t('ai_translate_no_text_capability'), { requestId, aiModel })
      return json(res, 400, { error: `Model ${aiModel} does not support text generation` }, origin)
    }

    try {
      const rawTranslations = await requestChatCompletion({
        requestId,
        route: '/api/ai/translate',
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

      let translations = parseTranslations(rawTranslations)

      if (shouldRetryTranslations(targetLanguage, translations)) {
        log('WARN', t('ai_translate_wrong_lang_retry'), {
          requestId,
          aiModel: model.id,
          targetLanguage,
        })

        const retryRaw = await requestChatCompletion({
          requestId,
          route: '/api/ai/translate',
          baseUrl,
          apiKey,
          model: model.id,
          systemPrompt: TRANSLATE_SYSTEM_PROMPT,
          userPrompt: buildTranslateRetryPrompt(sourceLanguage, targetLanguage, items),
          timeoutMs,
          retries: 1,
          temperature: 0,
          maxTokens: 4000,
        })

        translations = parseTranslations(retryRaw)
      }

      if (translations.length !== items.length) {
        log('WARN', t('ai_translate_count_mismatch_retry'), {
          requestId,
          aiModel: model.id,
          expected: items.length,
          actual: translations.length,
        })

        const previousTranslations = translations
        const countRetryRaw = await requestChatCompletion({
          requestId,
          route: '/api/ai/translate',
          baseUrl,
          apiKey,
          model: model.id,
          systemPrompt: TRANSLATE_SYSTEM_PROMPT,
          userPrompt: buildTranslateCountRetryPrompt(sourceLanguage, targetLanguage, items, items.length),
          timeoutMs,
          retries: 1,
          temperature: 0,
          maxTokens: 4000,
        })
        const countRetryTranslations = parseTranslations(countRetryRaw)
        translations = countRetryTranslations.length >= previousTranslations.length
          ? countRetryTranslations
          : previousTranslations
      }

      if (translations.length !== items.length) {
        log('WARN', t('ai_translate_count_mismatch'), {
          requestId,
          aiModel: model.id,
          expected: items.length,
          actual: translations.length,
        })
        for (let i = translations.length; i < items.length; i += 1) {
          translations.push(items[i])
        }
      }

      log('INFO', t('ai_translate_generated'), {
        requestId,
        aiModel: model.id,
        items: items.length,
        totalChars,
        targetLanguage,
      })

      return json(res, 200, {
        translations,
        model: model.id,
        modelName: model.name,
      }, origin)
    } catch (error) {
      log('ERROR', t('ai_translate_failed'), {
        requestId,
        aiModel: model.id,
        items: items.length,
        targetLanguage,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, 502, {
        error: error instanceof Error ? error.message : 'Failed to translate content',
      }, origin)
    }
  }

  async function handleAiModels(req, res, origin) {
    return json(res, 200, getAiRegistry(), origin)
  }

  async function handleTranslationModels(req, res, origin) {
    return json(res, 200, getTranslationRegistry(), origin)
  }

  return {
    handleSummary,
    handleSecureAi,
    handleTranslate,
    handleAiModels,
    handleTranslationModels,
  }
}
