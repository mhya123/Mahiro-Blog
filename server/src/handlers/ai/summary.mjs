import { t } from '../../core/locales.mjs'
import { findAiModelById } from './config.mjs'
import { requestChatCompletion } from './api.mjs'
import { SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt } from './prompts.mjs'
import { cleanSummaryOutput } from './utils.mjs'

export function createSummaryHandlers({ log, json, readJsonBody, defaultBaseUrl, defaultTimeoutMs, defaultRetries }) {
  const summaryEnabled = (process.env.AI_SUMMARY_ENABLED || 'true') !== 'false'

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
        log,
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

  async function handleSummary(req, res, origin) {
    const requestId = req.requestId

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

    const result = await runSummaryPayload(requestId, payload)
    return json(res, result.status, result.body, origin)
  }

  return { runSummaryPayload, handleSummary }
}
