import { ENGLISH_STOPWORDS } from './prompts.mjs'

export function extractResponseText(payload) {
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

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function cleanSummaryOutput(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^```[\s\S]*?```$/g, '')
    .replace(/^\s*(summary|摘要)\s*[:：]?\s*/i, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseTranslations(raw) {
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

export function containsExpectedScript(language, text) {
  const normalized = String(language || '').trim().toLowerCase()

  if (normalized === 'ja') return /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/u.test(text)
  if (normalized === 'ko') return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text)
  if (normalized === 'ru') return /[\u0400-\u04ff]/u.test(text)
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-tw') {
    return /[\u4e00-\u9fff]/u.test(text)
  }

  return false
}

export function isLikelyEnglishText(text) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return false

  const latinWords = normalized.match(/[a-z']+/g) || []
  if (latinWords.length < 2) return false

  const stopwordHits = latinWords.filter((word) => ENGLISH_STOPWORDS.has(word)).length
  const nonLatinChars = (normalized.match(/[^\x00-\x7f]/g) || []).length

  return stopwordHits >= 2 && nonLatinChars <= Math.max(2, normalized.length * 0.15)
}

export function shouldRetryTranslations(targetLanguage, translations) {
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
