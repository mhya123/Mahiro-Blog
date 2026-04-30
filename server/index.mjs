/**
 * @file index.mjs
 * @description 后端服务入口。
 *
 * 初始化 Redis 缓存 → AList 网盘 → AI 服务 → HTTP 路由，启动监听。
 */

import { dirname, resolve } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createAiHandlers } from './src/handlers/ai.mjs'
import { createAListService } from './src/services/alist/index.mjs'
import { createDriveCrypto } from './src/handlers/crypto.mjs'
import { createDriveHandlers } from './src/handlers/drive.mjs'
import { loadEnvFile } from './src/core/env.mjs'
import { createHttpUtils } from './src/core/http.mjs'
import { createFileLogger } from './src/core/log-file.mjs'
import { createLogger, t } from './src/core/logger.mjs'
import { createRateLimiter } from './src/core/rate-limiter.mjs'
import { createRedisCache } from './src/core/redis.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvFile(resolve(__dirname, '.env'))

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 3
const PORT = Number(process.env.PORT || 3000)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const rateLimiter = createRateLimiter()

// AI 端点额外限制（与全局限制叠加）
rateLimiter.addRule('/api/ai/', {
  max: Number(process.env.RATE_LIMIT_AI_MAX || 10),
})

const { log: consoleLog, createRequestId, getClientIp } = createLogger()
const fileLogger = createFileLogger()
fileLogger.cleanup()

const log = (level, message, meta) => {
  fileLogger.write(level, message, meta)
  consoleLog(level, message, meta)
}
const {
  buildCorsHeaders,
  json,
  getOrigin,
  getQueryString,
  getQueryBoolean,
  getQueryNumber,
  encodeContentDispositionFilename,
  readJsonBody,
} = createHttpUtils({ allowedOrigins: ALLOWED_ORIGINS })

// ── Redis 缓存 ──
const cache = createRedisCache({
  log,
  enabled: process.env.CACHE_ENABLED !== 'false',
})

const alistService = createAListService({
  log,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  cache,
})

const driveCrypto = createDriveCrypto({
  enabled: (process.env.API_RSA_ENCRYPTION || process.env.DRIVE_RSA_ENCRYPTION) !== 'false',
})

const { handleSummary, handleSecureAi, handleTranslate, handleAiModels, handleTranslationModels } = createAiHandlers({
  log,
  json,
  readJsonBody,
  driveCrypto,
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultRetries: DEFAULT_RETRIES,
})

const {
  handleDriveCryptoPublicKey,
  handleDriveSecure,
  handleDriveStatus,
  handleDriveList,
  handleDriveItem,
  handleDriveSearch,
  handleDriveMkdir,
  handleDriveRename,
  handleDriveRemove,
  handleDriveMove,
  handleDriveCopy,
  handleDriveUpload,
  handleDriveRaw,
} = createDriveHandlers({
  alistService,
  driveCrypto,
  log,
  json,
  readJsonBody,
  buildCorsHeaders,
  getQueryString,
  getQueryBoolean,
  getQueryNumber,
  encodeContentDispositionFilename,
})

const routes = {
  'GET:/health': (req, res, origin) => json(res, 200, { ok: true, redis: cache.getStats() }, origin),
  'GET:/api/drive/status': handleDriveStatus,
  'GET:/api/drive/crypto/public-key': handleDriveCryptoPublicKey,
  'GET:/api/crypto/public-key': handleDriveCryptoPublicKey,
  'POST:/api/drive/secure': handleDriveSecure,
  'GET:/api/drive/list': handleDriveList,
  'GET:/api/drive/item': handleDriveItem,
  'GET:/api/drive/raw': handleDriveRaw,
  'POST:/api/drive/search': handleDriveSearch,
  'POST:/api/drive/mkdir': handleDriveMkdir,
  'POST:/api/drive/rename': handleDriveRename,
  'POST:/api/drive/remove': handleDriveRemove,
  'POST:/api/drive/move': handleDriveMove,
  'POST:/api/drive/copy': handleDriveCopy,
  'POST:/api/drive/upload': handleDriveUpload,
  'POST:/api/ai/summary': handleSummary,
  'POST:/api/ai/secure': handleSecureAi,
  'POST:/api/ai/translate': handleTranslate,
  'GET:/api/ai/translation-models': handleTranslationModels,
  'GET:/api/ai/models': handleAiModels,
}

const server = createServer(async (req, res) => {
  req.requestId = createRequestId()
  const startedAt = Date.now()
  const origin = getOrigin(req)
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const requestMeta = {
    requestId: req.requestId,
    method: req.method,
    path: url.pathname,
    ip: getClientIp(req),
  }

  log('INFO', t('incoming_request'), requestMeta)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, buildCorsHeaders(origin))
    res.end()
    log('INFO', t('request_completed'), {
      ...requestMeta,
      status: 204,
      durationMs: Date.now() - startedAt,
    })
    return
  }

  const limitResult = rateLimiter.check(requestMeta.ip, url.pathname)
  if (!limitResult.allowed) {
    const headers = {
      'Retry-After': String(limitResult.retryAfter),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(limitResult.reset / 1000)),
    }
    log('WARN', t('rate_limit_exceeded'), {
      ...requestMeta,
      retryAfter: limitResult.retryAfter,
      reset: limitResult.reset,
    })
    return json(res, 429, { error: t('rate_limit_exceeded'), retryAfter: limitResult.retryAfter }, origin, headers)
  }

  const routeKey = `${req.method}:${url.pathname}`
  const routeHandler = routes[routeKey]

  if (routeHandler) {
    try {
      return await routeHandler(req, res, origin, url)
    } catch (error) {
      log('ERROR', t('route_handler_crashed'), {
        ...requestMeta,
        error: error instanceof Error ? error.stack || error.message : String(error),
      })
      if (!res.headersSent) {
        return json(res, 500, { error: 'Internal server error' }, origin)
      }
      return
    }
  }

  log('WARN', t('route_not_found'), requestMeta)
  return json(res, 404, { error: 'Not found' }, origin)
})

server.on('request', (req, res) => {
  const startedAt = Date.now()
  const requestId = req.requestId || createRequestId()

  res.on('finish', () => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    log('INFO', t('request_completed'), {
      requestId,
      method: req.method,
      path: url.pathname,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    })
  })
})

server.listen(PORT, () => {
  log('INFO', t('server_started'), {
    port: PORT,
    envFile: resolve(__dirname, '.env'),
    redis: cache.getStats(),
  })
})

process.on('unhandledRejection', (error) => {
  log('ERROR', t('unhandled_rejection'), {
    error: error instanceof Error ? error.stack || error.message : String(error),
  })
})

process.on('uncaughtException', (error) => {
  log('ERROR', t('uncaught_exception'), {
    error: error instanceof Error ? error.stack || error.message : String(error),
  })
})

// 优雅关闭
process.on('SIGTERM', async () => {
  log('INFO', t('sigterm_shutdown'))
  await cache.quit()
  server.close(() => process.exit(0))
})

process.on('SIGINT', async () => {
  log('INFO', t('sigint_shutdown'))
  await cache.quit()
  server.close(() => process.exit(0))
})
