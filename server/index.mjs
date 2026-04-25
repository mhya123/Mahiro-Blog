import { dirname, resolve } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createAiHandlers } from './ai-handlers.mjs'
import { createAListService } from './alist.mjs'
import { createDriveCrypto } from './drive-crypto.mjs'
import { createDriveHandlers } from './drive-handlers.mjs'
import { loadEnvFile } from './env-utils.mjs'
import { createHttpUtils } from './http-utils.mjs'
import { createLogger } from './logger.mjs'

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

const { log, createRequestId, getClientIp } = createLogger()
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

const alistService = createAListService({
  log,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
})

const driveCrypto = createDriveCrypto({
  enabled: (process.env.API_RSA_ENCRYPTION || process.env.DRIVE_RSA_ENCRYPTION) !== 'false',
})

const { handleSummary, handleSecureAi, handleTranslate } = createAiHandlers({
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

  log('INFO', 'Incoming request', requestMeta)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, buildCorsHeaders(origin))
    res.end()
    log('INFO', 'Request completed', {
      ...requestMeta,
      status: 204,
      durationMs: Date.now() - startedAt,
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true }, origin)
  }

  if (req.method === 'GET' && url.pathname === '/api/drive/status') {
    return handleDriveStatus(req, res, origin)
  }

  if (req.method === 'GET' && url.pathname === '/api/drive/crypto/public-key') {
    return handleDriveCryptoPublicKey(req, res, origin)
  }

  if (req.method === 'GET' && url.pathname === '/api/crypto/public-key') {
    return handleDriveCryptoPublicKey(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/secure') {
    return handleDriveSecure(req, res, origin)
  }

  if (req.method === 'GET' && url.pathname === '/api/drive/list') {
    return handleDriveList(req, res, origin, url)
  }

  if (req.method === 'GET' && url.pathname === '/api/drive/item') {
    return handleDriveItem(req, res, origin, url)
  }

  if (req.method === 'GET' && url.pathname === '/api/drive/raw') {
    return handleDriveRaw(req, res, origin, url)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/search') {
    return handleDriveSearch(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/mkdir') {
    return handleDriveMkdir(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/rename') {
    return handleDriveRename(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/remove') {
    return handleDriveRemove(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/move') {
    return handleDriveMove(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/copy') {
    return handleDriveCopy(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/drive/upload') {
    return handleDriveUpload(req, res, origin, url)
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/summary') {
    return handleSummary(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/secure') {
    return handleSecureAi(req, res, origin)
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/translate') {
    return handleTranslate(req, res, origin)
  }

  log('WARN', 'Request rejected: route not found', requestMeta)
  return json(res, 404, { error: 'Not found' }, origin)
})

server.on('request', (req, res) => {
  const startedAt = Date.now()
  const requestId = req.requestId || createRequestId()

  res.on('finish', () => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    log('INFO', 'Request completed', {
      requestId,
      method: req.method,
      path: url.pathname,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    })
  })
})

server.listen(PORT, () => {
  log('INFO', 'Server started', { port: PORT, envFile: resolve(__dirname, '.env') })
})

process.on('unhandledRejection', (error) => {
  log('ERROR', 'Unhandled promise rejection', {
    error: error instanceof Error ? error.stack || error.message : String(error),
  })
})

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', {
    error: error instanceof Error ? error.stack || error.message : String(error),
  })
})
