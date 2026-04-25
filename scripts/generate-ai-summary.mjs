import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { constants, createCipheriv, createDecipheriv, publicEncrypt, randomBytes } from 'node:crypto'
import dotenv from 'dotenv'
import yaml from 'js-yaml'

dotenv.config()

const DEFAULT_DIR = 'src/content/blog'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 3
const SUMMARY_MAX_SOURCE_CHARS = 24_000
const SECURE_API_VERSION = 'rsa-oaep-aes-gcm-v1'
const GCM_TAG_BYTES = 16
const servicePublicKeyCache = new Map()

const SYSTEM_PROMPT = [
  '你是一个只负责压缩摘要的模型。',
  '你的任务是对给定 Markdown 文章做忠实压缩摘要。',
  '禁止扩写、脑补、补充背景、加解释、加评价、加引导语、加免责声明。',
  '禁止输出“本文介绍了”“这篇文章将”“你可以看到”等套话。',
  '只输出摘要正文，不要标题，不要项目符号，不要代码块，不要引用符号。',
  '摘要必须基于原文可确认的信息，长度控制在 80 到 180 个中文字符内，最多两段。',
].join('\n')

function printUsage() {
  console.log(`
Usage:
  node scripts/generate-ai-summary.mjs --file <path>
  node scripts/generate-ai-summary.mjs --all [--dir <path>] [--skip-same-model] [--start-after <filename>]

Options:
  --file <path>         Process a single Markdown/MDX file
  --all                 Process all Markdown/MDX files under a directory
  --dir <path>          Directory to scan, default: ${DEFAULT_DIR}
  --model <id>          Override frontmatter aiModel for this run
  --channel <mode>      Summary channel: local or service
  --service-url <url>   External summary service base URL
  --skip-same-model     Skip file when existing AI block already uses the same model
  --start-after <name>  Start after a given filename or relative path in sorted order
  --list-models         Print supported models from scripts/ai-models.json
  --help                Show this help
`)
}

function parseArgs(argv) {
  const args = {
    file: null,
    all: false,
    dir: DEFAULT_DIR,
    model: null,
    channel: null,
    serviceUrl: null,
    skipSameModel: false,
    startAfter: null,
    listModels: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--file':
        args.file = argv[++i] ?? null
        break
      case '--all':
        args.all = true
        break
      case '--dir':
        args.dir = argv[++i] ?? DEFAULT_DIR
        break
      case '--model':
        args.model = argv[++i] ?? null
        break
      case '--channel':
        args.channel = argv[++i] ?? null
        break
      case '--service-url':
        args.serviceUrl = argv[++i] ?? null
        break
      case '--skip-same-model':
        args.skipSameModel = true
        break
      case '--start-after':
        args.startAfter = argv[++i] ?? null
        break
      case '--list-models':
        args.listModels = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

async function loadModelRegistry() {
  const registryPath = path.resolve('scripts/ai-models.json')
  const raw = await fs.readFile(registryPath, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed.models) ? parsed.models : []
}

function resolveModel(modelId, registry) {
  const matched = registry.find((item) => item.id === modelId)
  if (!matched) return null
  return {
    id: matched.id,
    displayName: matched.name || matched.id,
    brand: matched.brand || 'Unknown',
    capabilities: matched.capabilities || [],
    supportsReasoning: Boolean(matched.supportsReasoning),
    supportsVision: Boolean(matched.supportsVision),
  }
}

function normalizeChannel(value) {
  const channel = String(value || 'local').trim().toLowerCase()
  if (!['local', 'service'].includes(channel)) {
    throw new Error(`Unsupported channel: ${value}`)
  }
  return channel
}

function ensureRuntime(args = {}) {
  const channel = normalizeChannel(args.channel || process.env.AI_SUMMARY_CHANNEL || 'local')

  if (channel === 'service') {
    const serviceUrl = String(args.serviceUrl || process.env.AI_SUMMARY_SERVICE_URL || '').trim().replace(/\/+$/, '')
    if (!serviceUrl) {
      throw new Error('Missing AI_SUMMARY_SERVICE_URL')
    }

    return {
      channel,
      serviceUrl,
      timeoutMs: Number(process.env.AI_SUMMARY_SERVICE_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      retries: Number(process.env.AI_SUMMARY_SERVICE_RETRIES || process.env.OPENAI_RETRIES || DEFAULT_RETRIES),
    }
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  return {
    channel,
    baseUrl,
    apiKey,
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    retries: Number(process.env.OPENAI_RETRIES || DEFAULT_RETRIES),
  }
}

function isMarkdownFile(filePath) {
  return /\.(md|mdx|markdown)$/i.test(filePath)
}

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return walkMarkdownFiles(fullPath)
      return isMarkdownFile(entry.name) ? [fullPath] : []
    })
  )

  return files.flat().sort((a, b) => a.localeCompare(b))
}

function splitFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return {
      data: {},
      body: normalized,
      hasFrontmatter: false,
      newline: text.includes('\r\n') ? '\r\n' : '\n',
    }
  }

  let data = {}
  try {
    data = yaml.load(match[1]) || {}
  } catch (error) {
    throw new Error(`Failed to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`)
  }

  return {
    data,
    body: match[2],
    hasFrontmatter: true,
    newline: text.includes('\r\n') ? '\r\n' : '\n',
  }
}

function extractLeadingAiBlock(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let index = 0

  while (index < lines.length && lines[index].trim() === '') index += 1

  const firstLine = lines[index] || ''
  const match = firstLine.match(/^>\s*\[!ai\]\s*(.+?)\s*$/)
  if (!match) {
    return {
      modelLabel: null,
      cleanedBody: body.replace(/\r\n/g, '\n'),
      removed: false,
    }
  }

  let end = index + 1
  while (end < lines.length && lines[end].startsWith('>')) end += 1
  while (end < lines.length && lines[end].trim() === '') end += 1

  const cleanedLines = [...lines.slice(0, index), ...lines.slice(end)]
  return {
    modelLabel: match[1].trim(),
    cleanedBody: cleanedLines.join('\n').replace(/^\n+/, ''),
    removed: true,
  }
}

function stringifyFrontmatter(data) {
  const cleaned = {}
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    cleaned[key] = value
  }
  return `---\n${yaml.dump(cleaned)}---\n`
}

function formatAiBlock(modelName, summary) {
  const lines = summary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error('Model returned an empty summary')
  }

  return [`> [!ai] ${modelName}`, ...lines.map((line) => `> ${line}`)].join('\n')
}

function cleanSummaryOutput(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^```[\s\S]*?```$/g, '')
    .replace(/^\s*(摘要[:：]\s*)/i, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildUserPrompt(filePath, frontmatter, body) {
  const title = typeof frontmatter.title === 'string' ? frontmatter.title : path.basename(filePath)
  const source = body.length > SUMMARY_MAX_SOURCE_CHARS ? body.slice(0, SUMMARY_MAX_SOURCE_CHARS) : body
  return [
    `文件: ${filePath}`,
    `标题: ${title}`,
    '请只输出摘要正文。',
    '不要输出标题，不要输出“摘要”，不要加前言或结语。',
    '以下是文章 Markdown 正文：',
    source,
  ].join('\n\n')
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

function fromBase64(base64) {
  return Buffer.from(String(base64 || ''), 'base64')
}

function encryptSecurePayload(publicKey, payload) {
  const aesKey = randomBytes(32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  const encryptedKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  )

  return {
    aesKey,
    envelope: {
      encrypted: true,
      version: SECURE_API_VERSION,
      key: toBase64(encryptedKey),
      iv: toBase64(iv),
      data: toBase64(Buffer.concat([ciphertext, tag])),
    },
  }
}

function decryptSecurePayload(aesKey, envelope) {
  if (!envelope?.encrypted || envelope.version !== SECURE_API_VERSION || !envelope.iv || !envelope.data) {
    throw new Error(envelope?.error || envelope?.message || 'Invalid encrypted service response')
  }

  const encryptedPayload = fromBase64(envelope.data)
  if (encryptedPayload.length <= GCM_TAG_BYTES) {
    throw new Error('Invalid encrypted service response body')
  }

  const ciphertext = encryptedPayload.subarray(0, encryptedPayload.length - GCM_TAG_BYTES)
  const tag = encryptedPayload.subarray(encryptedPayload.length - GCM_TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', aesKey, fromBase64(envelope.iv))
  decipher.setAuthTag(tag)

  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'))
}

async function loadServicePublicKey(runtime) {
  const cacheKey = runtime.serviceUrl
  if (!servicePublicKeyCache.has(cacheKey)) {
    servicePublicKeyCache.set(cacheKey, (async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), runtime.timeoutMs)

      try {
        const response = await fetch(`${runtime.serviceUrl}/api/crypto/public-key`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
        }
        if (!payload?.enabled || !payload.publicKey) {
          throw new Error('Summary service encryption key is unavailable')
        }

        return payload.publicKey
      } catch (error) {
        servicePublicKeyCache.delete(cacheKey)
        throw error
      } finally {
        clearTimeout(timer)
      }
    })())
  }

  return servicePublicKeyCache.get(cacheKey)
}

async function requestSummaryViaLocalModel(runtime, modelId, prompt) {
  const endpoint = `${runtime.baseUrl}/chat/completions`

  for (let attempt = 1; attempt <= runtime.retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), runtime.timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtime.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
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
      const isLastAttempt = attempt === runtime.retries
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[warn] API attempt ${attempt}/${runtime.retries} failed: ${message}`)
      if (isLastAttempt) throw error
      await sleep(Math.min(1000 * attempt, 3000))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Unreachable retry state')
}

async function requestSummaryViaService(runtime, modelId, title, body) {
  const endpoint = `${runtime.serviceUrl}/api/ai/secure`

  for (let attempt = 1; attempt <= runtime.retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), runtime.timeoutMs)

    try {
      const publicKey = await loadServicePublicKey(runtime)
      const encrypted = encryptSecurePayload(publicKey, {
        action: 'summary',
        payload: {
          title,
          content: body,
          aiModel: modelId,
        },
      })
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encrypted.envelope),
      })

      const encryptedPayload = await response.json().catch(() => ({}))
      const payload = decryptSecurePayload(encrypted.aesKey, encryptedPayload)
      if (!response.ok) {
        const message = payload?.error || payload?.message || `HTTP ${response.status}`
        throw new Error(message)
      }

      if (!payload?.summary || typeof payload.summary !== 'string') {
        throw new Error('Service did not return a valid summary')
      }

      return cleanSummaryOutput(payload.summary)
    } catch (error) {
      const isLastAttempt = attempt === runtime.retries
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[warn] Service attempt ${attempt}/${runtime.retries} failed: ${message}`)
      if (isLastAttempt) throw error
      await sleep(Math.min(1000 * attempt, 3000))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Unreachable retry state')
}

async function requestSummary(runtime, modelId, filePath, frontmatter, body) {
  const title = typeof frontmatter.title === 'string' ? frontmatter.title : path.basename(filePath)

  if (runtime.channel === 'service') {
    return requestSummaryViaService(runtime, modelId, title, body)
  }

  const prompt = buildUserPrompt(filePath, frontmatter, body)
  return requestSummaryViaLocalModel(runtime, modelId, prompt)
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

function resolveTargetFiles(args, files) {
  if (args.file) return [path.resolve(args.file)]

  let selected = files
  if (args.startAfter) {
    const normalizedStartAfter = args.startAfter.replace(/\\/g, '/')
    const exactIndex = selected.findIndex((filePath) => {
      const relative = path.relative(process.cwd(), filePath).replace(/\\/g, '/')
      return relative === normalizedStartAfter || path.basename(filePath) === args.startAfter
    })

    if (exactIndex >= 0) {
      selected = selected.slice(exactIndex + 1)
    } else {
      console.warn(`[warn] --start-after target not found, using lexical fallback: ${args.startAfter}`)
      selected = selected.filter((filePath) => path.basename(filePath).localeCompare(args.startAfter) > 0)
    }
  }

  return selected
}

function resolveRequestedModelId(args, frontmatter) {
  return args.model || frontmatter.aiModel || ''
}

async function processFile(filePath, runtime, registry, options) {
  const absolutePath = path.resolve(filePath)
  const raw = await fs.readFile(absolutePath, 'utf8')
  const { data, body, hasFrontmatter, newline } = splitFrontmatter(raw)
  const requestedModelId = resolveRequestedModelId(options, data)

  if (!requestedModelId) {
    console.log(`[skip] ${path.relative(process.cwd(), absolutePath)} has no aiModel`)
    return { status: 'skipped' }
  }

  const modelMeta = resolveModel(requestedModelId, registry)
  if (!modelMeta) {
    throw new Error(`Unsupported aiModel: ${requestedModelId}`)
  }
  if (!modelMeta.capabilities.includes('text')) {
    throw new Error(`Model ${requestedModelId} does not support text generation`)
  }

  const existing = extractLeadingAiBlock(body)
  if (
    options.skipSameModel &&
    existing.modelLabel &&
    [modelMeta.displayName, modelMeta.id].includes(existing.modelLabel)
  ) {
    console.log(`[skip] ${path.relative(process.cwd(), absolutePath)} already uses ${existing.modelLabel}`)
    return { status: 'skipped' }
  }

  const sourceBody = existing.cleanedBody.trim()
  if (!sourceBody) {
    throw new Error('Markdown body is empty after removing existing AI summary block')
  }

  if (modelMeta.supportsReasoning) {
    console.log(`[info] ${path.relative(process.cwd(), absolutePath)} uses reasoning-capable model ${modelMeta.id}; provider-specific reasoning flags remain disabled`)
  }

  const summary = await requestSummary(runtime, modelMeta.id, absolutePath, data, sourceBody)
  const aiBlock = formatAiBlock(modelMeta.displayName, summary)

  const nextFrontmatter = { ...data }
  if (options.model || !nextFrontmatter.aiModel) {
    nextFrontmatter.aiModel = modelMeta.id
  }

  let output = ''
  if (hasFrontmatter) {
    output = `${stringifyFrontmatter(nextFrontmatter)}\n${aiBlock}\n\n${sourceBody.trimStart()}`
  } else {
    output = `${aiBlock}\n\n${sourceBody.trimStart()}`
  }

  const finalText = newline === '\r\n' ? output.replace(/\n/g, '\r\n') : output
  await fs.writeFile(absolutePath, finalText, 'utf8')
  console.log(`[done] ${path.relative(process.cwd(), absolutePath)} -> ${modelMeta.displayName}`)
  return { status: 'updated' }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const registry = await loadModelRegistry()
  if (args.listModels) {
    for (const model of registry) {
      const capabilities = Array.isArray(model.capabilities) ? model.capabilities.join(',') : ''
      console.log(`${model.id}\t${model.name}\t${model.brand}\t${capabilities}`)
    }
    return
  }

  if (!args.file && !args.all) {
    throw new Error('Specify either --file <path> or --all')
  }

  const runtime = ensureRuntime(args)
  const rootDir = path.resolve(args.dir)

  let targets = []
  if (args.file) {
    targets = [path.resolve(args.file)]
  } else {
    const files = await walkMarkdownFiles(rootDir)
    targets = resolveTargetFiles(args, files)
  }

  if (targets.length === 0) {
    console.log('[info] No files matched')
    return
  }

  console.log(`[info] Channel: ${runtime.channel}`)
  if (runtime.channel === 'service') {
    console.log(`[info] Service URL: ${runtime.serviceUrl}`)
  } else {
    console.log(`[info] Base URL: ${runtime.baseUrl}`)
  }
  console.log(`[info] Files: ${targets.length}`)
  if (args.model) {
    console.log(`[info] CLI model override: ${args.model}`)
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const filePath of targets) {
    try {
      const result = await processFile(filePath, runtime, registry, args)
      if (result.status === 'updated') updated += 1
      if (result.status === 'skipped') skipped += 1
    } catch (error) {
      failed += 1
      console.error(`[error] ${path.relative(process.cwd(), filePath)}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`[summary] updated=${updated} skipped=${skipped} failed=${failed}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
