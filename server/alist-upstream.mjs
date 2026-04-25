import { encodePathSegments, normalizePath } from './alist-paths.mjs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
}) {
  const redirectCache = new Map()
  const tokenState = {
    value: staticToken,
    expiresAt: staticToken ? Date.now() + defaultTokenTtlMs : 0,
  }

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

  async function resolveDirectUrl(requestId, inputUrl) {
    const sourceUrl = String(inputUrl || '').trim()
    if (!sourceUrl) {
      return ''
    }

    const cached = redirectCache.get(sourceUrl)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
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
        log('WARN', 'Drive direct URL resolve failed, falling back to signed URL', {
          requestId,
          url: currentUrl,
          error: error instanceof Error ? error.message : String(error),
        })
        break
      } finally {
        clearTimeout(timer)
      }
    }

    redirectCache.set(sourceUrl, {
      value: currentUrl,
      expiresAt: Date.now() + redirectCacheTtlMs,
    })

    return currentUrl
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
      log('INFO', 'AList upstream request started', {
        requestId,
        method,
        path,
      })

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
    } catch (error) {
      const authFailed = error?.status === 401 || error?.upstreamCode === 401

      log(authFailed ? 'WARN' : 'ERROR', 'AList upstream request failed', {
        requestId,
        method,
        path,
        status: error?.status,
        error: error instanceof Error ? error.message : String(error),
      })

      if (auth && retryOnAuthFailure && authFailed && !staticToken) {
        tokenState.value = ''
        tokenState.expiresAt = 0
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

      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async function getAccessToken(requestId, force = false) {
    if (staticToken) {
      return staticToken
    }

    if (!force && tokenState.value && tokenState.expiresAt > Date.now()) {
      return tokenState.value
    }

    if (!username || !password) {
      const error = new Error('Missing ALIST_USERNAME or ALIST_PASSWORD')
      error.status = 500
      throw error
    }

    const data = await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/auth/login',
      auth: false,
      body: {
        username,
        password,
      },
      retryOnAuthFailure: false,
    })

    const token = String(data?.token || data || '').trim()
    if (!token) {
      const error = new Error('AList login succeeded but returned no token')
      error.status = 502
      throw error
    }

    tokenState.value = token
    tokenState.expiresAt = Date.now() + defaultTokenTtlMs

    log('INFO', 'AList login succeeded', {
      requestId,
      username,
    })

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
