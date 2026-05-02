export const MAX_SOURCE_CHARS = 24_000
export const MAX_ITEMS = 80
export const MAX_TOTAL_CHARS = 16_000

export const SUMMARY_SYSTEM_PROMPT = [
  '你是一个精炼文章的摘要助手',
  '用一段自然流畅的中文概括文章核心内容。',
  '不要添加任何解释、评价、背景信息或格式标记。',
  '必须是纯文本，绝对禁止使用任何 Markdown 格式（包括但不限于加粗、斜体、列表、换行符）',
  '简单但又包含重要信息，让读者能够理解文章的核心内容和价值。',
].join('\n')

export const TRANSLATE_SYSTEM_PROMPT = [
'您是一位专业的网站翻译人员。',
'将每个编号的项目翻译成请求的目标语言。',
'保留原文的含义、语气、格式和代码。',
'不要添加解释、注释、Markdown 代码块或额外字段。',
'以编号列表的形式返回翻译结果：1. xxx，2. xxx，等等。',
'保持完全相同的顺序和项目数量。',
'如果不确定目标语言，请尽力翻译成目标语言，但不要翻译成其他语言。',
].join('\n')

export const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'by',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'as', 'at', 'or',
  'not', 'but', 'can', 'will', 'would', 'should', 'could', 'page', 'site',
  'translation', 'translate', 'hello', 'world', 'test',
])

export function buildSummaryPrompt(title, content) {
  const source = content.length > MAX_SOURCE_CHARS ? content.slice(0, MAX_SOURCE_CHARS) : content
  return [
    `Title: ${title}`,
    '用一句话概括这篇文章的核心内容,简单但又包含重要信息，让读者能够理解文章的核心内容和价值,必须是纯文本，绝对禁止使用任何 Markdown 格式（包括但不限于加粗、斜体、列表、换行符）',
    source,
  ].join('\n\n')
}

export function getLanguageLabel(language) {
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

export function buildTranslatePrompt(sourceLanguage, targetLanguage, items) {
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

export function buildTranslateRetryPrompt(sourceLanguage, targetLanguage, items) {
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

export function buildTranslateCountRetryPrompt(sourceLanguage, targetLanguage, items, expectedCount) {
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
