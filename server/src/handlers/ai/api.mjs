import { t } from '../../core/locales.mjs'
import { extractResponseText, sleep } from './utils.mjs'

export async function requestChatCompletion({
  log,
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
