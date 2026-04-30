/**
 * @file alist-upstream.mjs
 * @description AList 上游通信层。
 *
 * 职责：
 * - 管理 AList 鉴权 Token（Redis 持久化 + 内存热缓存）
 * - 发起上游 HTTP 请求，内置**重试机制**和**超时分类**
 * - 重定向链解析 + Redis 缓存
 */

import { encodePathSegments, normalizePath } from './paths.mjs'
import { t } from '../../core/locales.mjs'

// ── 重试相关常量 ──
const RETRY_MAX_ATTEMPTS = 2
const RETRY_BASE_DELAY_MS = 500
const RETRYABLE_METHODS = new Set(['GET', 'POST']) // AList 的 POST 是查询语义，可安全重试

// ── 不可重试的 AList 写入端点 ──
const NON_RETRYABLE_PATHS = new Set([
  '/api/fs/mkdir',
  '/api/fs/rename',
  '/api/fs/remove',
  '/api/fs/move',
  '/api/fs/copy',
  '/api/fs/form',      // upload
  '/api/auth/login',
])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableRequest(method, path) {
  if (!RETRYABLE_METHODS.has(method)) return false
  return !NON_RETRYABLE_PATHS.has(path)
}

/**
 * 将底层错误分类为更具体的 HTTP 状态码和消息
 */
function classifyUpstreamError(error) {
  const message = error?.message || String(error)

  // AbortController 超时
  if (error?.name === 'AbortError' || message.includes('aborted')) {
    return {
      status: 504,
      message: 'AList upstream request timed out',
      retryable: true,
    }
  }

  // DNS / 网络不可达
  if (
    message.includes('ECONNREFUSED')
    || message.includes('ENOTFOUND')
    || message.includes('EHOSTUNREACH')
    || message.includes('ECONNRESET')
    || message.includes('fetch failed')
    || message.includes('network')
  ) {
    return {
      status: 502,
      message: `AList upstream unreachable: ${message}`,
      retryable: true,
    }
  }

  // 有明确 HTTP 状态码的上游错误
  if (error?.status) {
    return {
      status: error.status,
      message: message,
      retryable: error.status >= 500,
    }
  }

  return {
    status: 500,
    message,
    retryable: false,
  }
}

async function parseUpstreamPayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }

  const text = await response.text().catch(() => '')
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function unwrapAListPayload(payload, response) {
  if (payload && typeof payload === 'object' && 'code' in payload) {
    const code = Number(payload.code)
    if (Number.isFinite(code) && code !== 200) {
      const error = new Error(payload.message || `AList error code ${code}`)
      error.status = response.status
      error.payload = payload
      error.upstreamCode = code
      throw error
    }
    return payload.data
  }

  return payload
}

function isSerializableBody(body) {
  return body
    && typeof body === 'object'
    && !(typeof FormData !== 'undefined' && body instanceof FormData)
    && !(body instanceof ArrayBuffer)
    && !ArrayBuffer.isView(body)
    && typeof body.pipe !== 'function'
}

export function createAListUpstream({
  log,
  baseUrl,
  username,
  password,
  staticToken,
  requestTimeoutMs,
  redirectCacheTtlMs,
  defaultTokenTtlMs,
  cache, // Redis 缓存实例
}) {
  // ── Token 热缓存（进程内） ──
  // Redis 用于持久化（进程重启恢复），内存用于热路径
  const tokenState = {
    value: staticToken,
    expiresAt: staticToken ? Date.now() + defaultTokenTtlMs : 0,
  }

  // Redis cache keys
  const TOKEN_CACHE_KEY = 'alist:token'
  const TOKEN_CACHE_TTL = Math.floor(defaultTokenTtlMs / 1000) // 12h in seconds
  const REDIRECT_CACHE_TTL = Math.floor(redirectCacheTtlMs / 1000) // 10min in seconds

  function isConfigured() {
    return Boolean(baseUrl && (staticToken || (username && password)))
  }

  function buildSignedRawUrl(inputPath, sign = '') {
    const normalizedPath = normalizePath(inputPath)
    const encodedPath = encodePathSegments(normalizedPath)
    const url = new URL(`${baseUrl}/d${encodedPath}`)

    if (sign) {
      url.searchParams.set('sign', sign)
    }

    return url.toString()
  }

  // ── 重定向解析（带 Redis 缓存） ──

  function redirectCacheKey(sourceUrl) {
    // 用简单 hash 避免 URL 太长作 key
    let hash = 0
    for (let i = 0; i < sourceUrl.length; i++) {
      hash = ((hash << 5) - hash + sourceUrl.charCodeAt(i)) | 0
    }
    return `alist:redirect:${hash.toString(36)}`
  }

  async function resolveDirectUrl(requestId, inputUrl) {
    const sourceUrl = String(inputUrl || '').trim()
    if (!sourceUrl) {
      return ''
    }

    // 1. 查 Redis 缓存
    if (cache) {
      const cached = await cache.get(redirectCacheKey(sourceUrl))
      if (cached) {
        return cached
      }
    }

    let currentUrl = sourceUrl

    for (let index = 0; index < 4; index += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs)

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            Range: 'bytes=0-0',
          },
        })

        const location = response.headers.get('location')
        if (location && [301, 302, 303, 307, 308].includes(response.status)) {
          currentUrl = new URL(location, currentUrl).toString()
          continue
        }

        break
      } catch (error) {
        log('WARN', t('alist_redirect_failed'), {
          requestId,
          url: currentUrl,
          error: error instanceof Error ? error.message : String(error),
        })
        break
      } finally {
        clearTimeout(timer)
      }
    }

    // 写入 Redis 缓存
    if (cache) {
      await cache.set(redirectCacheKey(sourceUrl), currentUrl, REDIRECT_CACHE_TTL)
    }

    return currentUrl
  }

  // ── 上游请求（带重试） ──

  async function requestUpstreamOnce({
    requestId,
    method = 'POST',
    path,
    body,
    headers = {},
    auth = true,
    responseType = 'json',
  }) {
    if (!isConfigured()) {
      const error = new Error('AList is not configured. Set ALIST_BASE_URL and either ALIST_TOKEN or ALIST_USERNAME/ALIST_PASSWORD.')
      error.status = 500
      throw error
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
    const url = `${baseUrl}${path}`
    const resolvedHeaders = { ...headers }

    if (auth) {
      const token = await getAccessToken(requestId)
      if (token) {
        resolvedHeaders.Authorization = token
      }
    }

    let requestBody = body
    if (isSerializableBody(body)) {
      resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] || 'application/json'
      requestBody = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: resolvedHeaders,
        body: requestBody,
        ...(requestBody && typeof requestBody.pipe === 'function' ? { duplex: 'half' } : {}),
      })

      if (responseType === 'stream') {
        if (!response.ok) {
          const payload = await parseUpstreamPayload(response)
          const error = new Error(payload?.message || `HTTP ${response.status}`)
          error.status = response.status
          error.payload = payload
          throw error
        }

        return response
      }

      const payload = await parseUpstreamPayload(response)
      if (!response.ok) {
        const error = new Error(payload?.message || `HTTP ${response.status}`)
        error.status = response.status
        error.payload = payload
        throw error
      }

      return unwrapAListPayload(payload, response)
    } finally {
      clearTimeout(timer)
    }
  }

  async function requestUpstream({
    requestId,
    method = 'POST',
    path,
    body,
    headers = {},
    auth = true,
    responseType = 'json',
    retryOnAuthFailure = true,
  }) {
    const canRetry = isRetryableRequest(method, path)
    const maxAttempts = canRetry ? 1 + RETRY_MAX_ATTEMPTS : 1

    let lastError

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await requestUpstreamOnce({
          requestId,
          method,
          path,
          body,
          headers,
          auth,
          responseType,
        })

        // 重试成功时记录日志
        if (attempt > 1) {
          log('INFO', t('alist_upstream_retry_success'), {
            requestId,
            method,
            path,
            attempt,
          })
        } else {
          log('INFO', t('alist_upstream_completed'), {
            requestId,
            method,
            path,
          })
        }

        return result
      } catch (error) {
        lastError = error

        // 401 鉴权失败 → 清除 Token 后重试一次
        const authFailed = error?.status === 401 || error?.upstreamCode === 401
        if (auth && retryOnAuthFailure && authFailed && !staticToken) {
          log('WARN', t('alist_auth_refreshing'), {
            requestId,
            method,
            path,
          })
          tokenState.value = ''
          tokenState.expiresAt = 0
          if (cache) await cache.del(TOKEN_CACHE_KEY)
          await sleep(100)
          return requestUpstream({
            requestId,
            method,
            path,
            body,
            headers,
            auth,
            responseType,
            retryOnAuthFailure: false,
          })
        }

        // 判断是否应该重试
        const classified = classifyUpstreamError(error)
        if (attempt < maxAttempts && classified.retryable) {
          const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
          log('WARN', t('alist_upstream_retrying'), {
            requestId,
            method,
            path,
            attempt,
            maxAttempts,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
            classifiedStatus: classified.status,
          })
          await sleep(delayMs)
          continue
        }

        // 不可重试或重试次数用尽
        log('ERROR', t('alist_upstream_failed'), {
          requestId,
          method,
          path,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          status: classified.status,
        })

        // 用分类后的状态码包装错误
        if (!error.status) {
          error.status = classified.status
        }
        if (!error.message || error.message === 'fetch failed') {
          error.message = classified.message
        }
        throw error
      }
    }

    throw lastError
  }

  // ── Token 管理（Redis 持久化 + 内存热缓存） ──

  async function getAccessToken(requestId, force = false) {
    if (staticToken) {
      return staticToken
    }

    // 1. 内存热缓存
    if (!force && tokenState.value && tokenState.expiresAt > Date.now()) {
      return tokenState.value
    }

    // 2. Redis 缓存（进程重启恢复）
    if (!force && cache) {
      const cached = await cache.get(TOKEN_CACHE_KEY)
      if (cached) {
        tokenState.value = cached
        tokenState.expiresAt = Date.now() + defaultTokenTtlMs
        log('INFO', t('alist_token_restored'), { requestId })
        return cached
      }
    }

    // 3. 重新登录
    if (!username || !password) {
      const error = new Error('Missing ALIST_USERNAME or ALIST_PASSWORD')
      error.status = 500
      throw error
    }

    const data = await requestUpstreamOnce({
      requestId,
      method: 'POST',
      path: '/api/auth/login',
      auth: false,
      body: {
        username,
        password,
      },
    })

    const token = String(data?.token || data || '').trim()
    if (!token) {
      const error = new Error('AList login succeeded but returned no token')
      error.status = 502
      throw error
    }

    // 写入内存 + Redis
    tokenState.value = token
    tokenState.expiresAt = Date.now() + defaultTokenTtlMs
    if (cache) {
      await cache.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL)
    }

    log('INFO', t('alist_login_succeeded'), { requestId, username })

    return token
  }

  return {
    isConfigured,
    buildSignedRawUrl,
    resolveDirectUrl,
    requestUpstream,
    getAccessToken,
  }
}
