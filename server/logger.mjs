function now() {
  return new Date().toISOString()
}

function serializeMeta(meta = {}) {
  const cleaned = Object.entries(meta).filter(([, value]) => value !== undefined)
  if (cleaned.length === 0) return ''
  return ` ${JSON.stringify(Object.fromEntries(cleaned))}`
}

export function createLogger({ logPrefix = '[server]' } = {}) {
  function log(level, message, meta) {
    const line = `${now()} ${logPrefix} [${level}] ${message}${serializeMeta(meta)}`
    if (level === 'ERROR') {
      console.error(line)
      return
    }
    if (level === 'WARN') {
      console.warn(line)
      return
    }
    console.log(line)
  }

  function createRequestId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim()
    }
    return req.socket?.remoteAddress || 'unknown'
  }

  return {
    log,
    createRequestId,
    getClientIp,
  }
}
