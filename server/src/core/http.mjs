export function createHttpUtils({ allowedOrigins = ['*'] } = {}) {
  function resolveCorsOrigin(origin) {
    if (allowedOrigins.includes('*')) {
      return '*'
    }

    if (origin && allowedOrigins.includes(origin)) {
      return origin
    }

    return allowedOrigins[0] || '*'
  }

  function buildCorsHeaders(origin) {
    return {
      'Access-Control-Allow-Origin': resolveCorsOrigin(origin),
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
  }

  function json(res, status, body, origin = '*', extraHeaders = {}) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(origin),
      ...extraHeaders,
    })
    res.end(JSON.stringify(body))
  }

  function getOrigin(req) {
    return req.headers.origin || '*'
  }

  function getQueryString(url, key, fallback = '') {
    const value = url.searchParams.get(key)
    return value === null ? fallback : String(value)
  }

  function getQueryBoolean(url, key, fallback = false) {
    const value = url.searchParams.get(key)
    if (value === null) return fallback
    return value === '1' || value === 'true'
  }

  function getQueryNumber(url, key, fallback) {
    const value = url.searchParams.get(key)
    if (value === null || value === '') return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function encodeContentDispositionFilename(filename) {
    return encodeURIComponent(String(filename || 'download'))
      .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let raw = ''

      req.on('data', (chunk) => {
        raw += chunk
        if (raw.length > 2_000_000) {
          reject(new Error('Request body too large'))
          req.destroy()
        }
      })

      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {})
        } catch {
          reject(new Error('Invalid JSON body'))
        }
      })

      req.on('error', reject)
    })
  }

  return {
    buildCorsHeaders,
    json,
    getOrigin,
    getQueryString,
    getQueryBoolean,
    getQueryNumber,
    encodeContentDispositionFilename,
    readJsonBody,
  }
}
