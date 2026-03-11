import type { APIRoute } from 'astro'
import { findAiModelById } from '@/lib/ai-models'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 3
const MAX_SOURCE_CHARS = 24_000

const SYSTEM_PROMPT = [
  '你是一个只负责压缩摘要的模型。',
  '你的任务是对给定 Markdown 文章做忠实压缩摘要。',
  '禁止扩写、脑补、补充背景、加解释、加评价、加引导语、加免责声明。',
  '禁止输出“本文介绍了”“这篇文章将”“你可以看到”等套话。',
  '只输出摘要正文，不要标题，不要项目符号，不要代码块，不要引用符号。',
  '摘要必须基于原文可确认的信息，长度控制在 80 到 180 个中文字符内，最多两段。',
].join('\n')

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function cleanSummaryOutput(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^```[\s\S]*?```$/g, '')
    .replace(/^\s*(摘要[:：]\s*)/i, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

function buildUserPrompt(title: string, content: string) {
  const source = content.length > MAX_SOURCE_CHARS ? content.slice(0, MAX_SOURCE_CHARS) : content
  return [
    `标题: ${title}`,
    '请只输出摘要正文。',
    '不要输出标题，不要输出“摘要”，不要加前言或结语。',
    '以下是文章 Markdown 正文：',
    source,
  ].join('\n\n')
}

async function requestSummary(baseUrl: string, apiKey: string, model: string, prompt: string, timeoutMs: number, retries: number) {
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
          temperature: 0.2,
          max_tokens: 220,
          stream: false,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`
        throw new Error(message)
      }

      const content = extractResponseText(payload)
      if (!content) throw new Error('No summary content returned by model')
      return cleanSummaryOutput(content)
    } catch (error) {
      if (attempt >= retries) throw error
      await sleep(Math.min(1000 * attempt, 3000))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Failed to generate summary')
}

export const POST: APIRoute = async ({ request }) => {
  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL
  const apiKey = process.env.OPENAI_API_KEY
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const retries = Number(process.env.OPENAI_RETRIES || DEFAULT_RETRIES)

  if (!apiKey) {
    return json(500, { error: 'Missing OPENAI_API_KEY' })
  }

  let payload: { title?: string; content?: string; aiModel?: string } = {}
  try {
    payload = await request.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const title = payload.title?.trim()
  const content = payload.content?.trim()
  const aiModel = payload.aiModel?.trim()

  if (!title) return json(400, { error: 'Missing title' })
  if (!content) return json(400, { error: 'Missing content' })
  if (!aiModel) return json(400, { error: 'Missing aiModel' })

  const model = await findAiModelById(aiModel)
  if (!model) {
    return json(400, { error: `Unsupported aiModel: ${aiModel}` })
  }

  if (model.capabilities && !model.capabilities.includes('text')) {
    return json(400, { error: `Model ${aiModel} does not support text generation` })
  }

  if (model.supportsReasoning) {
    console.info(`[ai-summary] reasoning-capable model selected: ${model.id}; provider-specific reasoning flags are intentionally disabled`)
  }

  try {
    const summary = await requestSummary(baseUrl, apiKey, model.id, buildUserPrompt(title, content), timeoutMs, retries)
    return json(200, {
      summary,
      model: model.id,
      modelName: model.name,
    })
  } catch (error) {
    console.error('[ai-summary] request failed:', error)
    return json(502, {
      error: error instanceof Error ? error.message : 'Failed to generate summary',
    })
  }
}
