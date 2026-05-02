import { t } from '../../core/locales.mjs'
import { findTranslationModelById } from './config.mjs'
import { requestChatCompletion } from './api.mjs'
import { TRANSLATE_SYSTEM_PROMPT, MAX_ITEMS, MAX_TOTAL_CHARS, buildTranslatePrompt, buildTranslateRetryPrompt, buildTranslateCountRetryPrompt } from './prompts.mjs'
import { parseTranslations, shouldRetryTranslations } from './utils.mjs'

export function createTranslateHandlers({ log, json, readJsonBody, defaultBaseUrl, defaultTimeoutMs, defaultRetries }) {
  const translateEnabled = (process.env.AI_TRANSLATE_ENABLED || 'true') !== 'false'

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
        log,
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
          log,
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
          log,
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

  async function handleTranslate(req, res, origin) {
    const requestId = req.requestId

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

    const result = await runTranslatePayload(requestId, payload)
    return json(res, result.status, result.body, origin)
  }

  return { runTranslatePayload, handleTranslate }
}
