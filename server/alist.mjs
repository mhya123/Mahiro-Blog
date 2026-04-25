import { PassThrough } from 'node:stream'

const DEFAULT_ALIST_BASE_URL = 'https://s.mahiro.work'
const DEFAULT_TIMEOUT_MS = 45_000
const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const DEFAULT_REDIRECT_CACHE_TTL_MS = 10 * 60 * 1000
const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 200
const DRIVE_PERMISSION_KEYS = ['upload', 'mkdir', 'view', 'download', 'rename', 'copy', 'move', 'remove']

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizePath(input = '/') {
  let value = String(input || '/').trim()
  if (!value || value === '.') {
    return '/'
  }

  value = value.replace(/\\/g, '/')
  if (!value.startsWith('/')) {
    value = `/${value}`
  }

  value = value.replace(/\/{2,}/g, '/')
  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1)
  }

  return value || '/'
}

function joinPath(dir, name) {
  const base = normalizePath(dir)
  const cleanName = String(name || '').trim().replace(/^\/+|\/+$/g, '')
  if (!cleanName) {
    return base
  }

  return base === '/' ? `/${cleanName}` : `${base}/${cleanName}`
}

function encodePathSegments(inputPath) {
  const normalized = normalizePath(inputPath)
  if (normalized === '/') {
    return '/'
  }

  return `/${normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

function getParentPath(inputPath) {
  const normalized = normalizePath(inputPath)
  if (normalized === '/') {
    return null
  }

  const parts = normalized.split('/').filter(Boolean)
  parts.pop()
  if (parts.length === 0) {
    return '/'
  }

  return `/${parts.join('/')}`
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let current = size
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }

  const precision = current >= 100 || index === 0 ? 0 : current >= 10 ? 1 : 2
  return `${current.toFixed(precision)} ${units[index]}`
}

function sanitizeName(value) {
  return String(value || '').trim().replace(/[\\/]/g, '')
}

function inferFileType(name) {
  const lowerName = String(name || '').toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/.test(lowerName)) return 'image'
  if (/\.(mp4|webm|flv|mkv|mov|avi|wmv|m4v|rmvb|rm|mpeg|mpg|3gp)$/.test(lowerName)) return 'video'
  if (/\.(mp3|aac|ogg|wma|flac|alac|m4a|ape|wav|aiff|midi|mid|amr)$/.test(lowerName)) return 'audio'
  if (/\.(pdf)$/.test(lowerName)) return 'pdf'
  if (/\.(txt|md|rtf|doc|docx|odt|pages|json|csv|xml|ya?ml|toml|ini|conf|cfg|log|html|css|js|ts|jsx|tsx|astro|py|java|php|sh|bat|sql|mdx|scss|ps1|go|rs|c|cpp|h)$/.test(lowerName)) return 'text'
  if (/\.(zip|7z|rar|tar|gz|bz2|xz)$/.test(lowerName)) return 'archive'
  return 'file'
}

function normalizeFileType(rawType, name, isDir = false) {
  if (isDir) {
    return 'folder'
  }

  const inferredType = inferFileType(name)
  const normalizedType = String(rawType || '').trim().toLowerCase()

  if (!normalizedType || /^\d+$/.test(normalizedType)) {
    return inferredType
  }

  if (['image', 'video', 'audio', 'pdf', 'text', 'archive', 'folder', 'file'].includes(normalizedType)) {
    return normalizedType
  }

  return inferredType
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
}

function isSubsequenceMatch(query, target) {
  if (!query) {
    return true
  }

  let index = 0
  for (const char of target) {
    if (char === query[index]) {
      index += 1
      if (index >= query.length) {
        return true
      }
    }
  }

  return false
}

function getSearchScore(entry, query) {
  const rawQuery = String(query || '').trim().toLowerCase()
  if (!rawQuery) {
    return Number.POSITIVE_INFINITY
  }

  const name = String(entry?.name || '').trim()
  const path = String(entry?.path || '').trim()
  const lowerName = name.toLowerCase()
  const lowerPath = path.toLowerCase()

  if (lowerName === rawQuery) return 0
  if (lowerName.startsWith(rawQuery)) return 1
  if (lowerName.includes(rawQuery)) return 2
  if (lowerPath.includes(rawQuery)) return 3

  const normalizedQuery = normalizeSearchText(rawQuery)
  const normalizedName = normalizeSearchText(name)
  const normalizedPath = normalizeSearchText(path)

  if (!normalizedQuery) return Number.POSITIVE_INFINITY
  if (normalizedName === normalizedQuery) return 4
  if (normalizedName.startsWith(normalizedQuery)) return 5
  if (normalizedName.includes(normalizedQuery)) return 6
  if (normalizedPath.includes(normalizedQuery)) return 7
  if (isSubsequenceMatch(normalizedQuery, normalizedName)) return 8
  if (isSubsequenceMatch(normalizedQuery, normalizedPath)) return 9

  return Number.POSITIVE_INFINITY
}

function buildDefaultPermissions() {
  return {
    upload: false,
    mkdir: false,
    view: true,
    download: true,
    rename: false,
    copy: false,
    move: false,
    remove: false,
  }
}

function parsePermissions(rawValue) {
  const defaults = buildDefaultPermissions()
  const raw = String(rawValue || '').trim()
  if (!raw) {
    return defaults
  }

  const next = Object.fromEntries(DRIVE_PERMISSION_KEYS.map((key) => [key, false]))
  const parts = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  for (const part of parts) {
    if (part === '*' || part === 'all') {
      return defaults
    }

    if (part in next) {
      next[part] = true
    }
  }

  return {
    ...defaults,
    ...next,
  }
}

function normalizeEntry(item, parentPath = '/') {
  const name = String(item?.name || '').trim()
  const entryPath = item?.path ? normalizePath(item.path) : joinPath(parentPath, name)
  const isDir = Boolean(item?.is_dir)
  const size = Number(item?.size || 0)

  return {
    name,
    path: entryPath,
    parentPath: getParentPath(entryPath),
    isDir,
    size,
    sizeLabel: isDir ? '--' : formatBytes(size),
    modified: String(item?.modified || item?.updated_at || ''),
    provider: String(item?.provider || ''),
    sign: String(item?.sign || ''),
    thumb: String(item?.thumb || ''),
    type: normalizeFileType(item?.type, name, isDir),
    hashInfo: item?.hash_info || item?.hashinfo || null,
    raw: item,
  }
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.isDir !== right.isDir) {
      return left.isDir ? -1 : 1
    }

    return left.name.localeCompare(right.name, 'zh-CN', {
      numeric: true,
      sensitivity: 'base',
    })
  })
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

export function createAListService({ log, defaultTimeoutMs = DEFAULT_TIMEOUT_MS }) {
  const baseUrl = (process.env.ALIST_BASE_URL || DEFAULT_ALIST_BASE_URL).replace(/\/+$/, '')
  const username = String(process.env.ALIST_USERNAME || '').trim()
  const password = String(process.env.ALIST_PASSWORD || '').trim()
  const staticToken = String(process.env.ALIST_TOKEN || '').trim()
  const defaultRoot = normalizePath(process.env.ALIST_ROOT_PATH || '/')
  const requestTimeoutMs = Number(process.env.ALIST_TIMEOUT_MS || defaultTimeoutMs || DEFAULT_TIMEOUT_MS)
  const permissions = parsePermissions(process.env.ALIST_PERMISSIONS)
  const redirectCacheTtlMs = Number(process.env.ALIST_REDIRECT_CACHE_TTL_MS || DEFAULT_REDIRECT_CACHE_TTL_MS)
  const redirectCache = new Map()

  const tokenState = {
    value: staticToken,
    expiresAt: staticToken ? Date.now() + DEFAULT_TOKEN_TTL_MS : 0,
  }

  function isConfigured() {
    return Boolean(baseUrl && (staticToken || (username && password)))
  }

  function getPublicConfig() {
    return {
      configured: isConfigured(),
      baseUrl,
      baseHost: (() => {
        try {
          return new URL(baseUrl).host
        } catch {
          return baseUrl
        }
      })(),
      defaultRoot,
      authMode: staticToken ? 'token' : username && password ? 'credentials' : 'none',
      username: username || null,
      permissions,
    }
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

  function assertPermission(permission) {
    if (permissions[permission] !== false) {
      return
    }

    const error = new Error(`Drive permission denied: ${permission}`)
    error.status = 403
    throw error
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
    if (
      body
      && typeof body === 'object'
      && !(body instanceof PassThrough)
      && !(typeof FormData !== 'undefined' && body instanceof FormData)
      && !(body instanceof ArrayBuffer)
      && !ArrayBuffer.isView(body)
      && typeof body.pipe !== 'function'
    ) {
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
    tokenState.expiresAt = Date.now() + DEFAULT_TOKEN_TTL_MS

    log('INFO', 'AList login succeeded', {
      requestId,
      username,
    })

    return token
  }

  async function getStatus(requestId) {
    const status = getPublicConfig()
    if (!status.configured) {
      return {
        ...status,
        connected: false,
      }
    }

    try {
      await getAccessToken(requestId)
      return {
        ...status,
        connected: true,
      }
    } catch (error) {
      log('ERROR', 'AList status check failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        ...status,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async function listDirectory(requestId, inputPath = defaultRoot, options = {}) {
    assertPermission('view')
    const path = normalizePath(inputPath)
    const data = await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/list',
      body: {
        path,
        password: options.password || '',
        page: Number(options.page || DEFAULT_PAGE),
        per_page: Number(options.perPage || DEFAULT_PER_PAGE),
        refresh: Boolean(options.refresh),
      },
    })

    const content = Array.isArray(data?.content) ? data.content : []
    return {
      path,
      parentPath: getParentPath(path),
      total: Number(data?.total || content.length),
      readme: typeof data?.readme === 'string' ? data.readme : '',
      write: Boolean(data?.write),
      provider: String(data?.provider || ''),
      items: sortEntries(content.map((item) => normalizeEntry(item, path))),
    }
  }

  async function listDirectoryEntriesAllPages(requestId, inputPath = defaultRoot) {
    const path = normalizePath(inputPath)
    const pageSize = 200
    let page = 1
    const entries = []

    while (true) {
      const data = await requestUpstream({
        requestId,
        method: 'POST',
        path: '/api/fs/list',
        body: {
          path,
          password: '',
          page,
          per_page: pageSize,
          refresh: false,
        },
      })

      const content = Array.isArray(data?.content) ? data.content : []
      entries.push(...content.map((item) => normalizeEntry(item, path)))

      const total = Number(data?.total || entries.length)
      if (content.length === 0 || page * pageSize >= total) {
        break
      }

      page += 1
    }

    return entries
  }

  async function getItem(requestId, inputPath, options = {}) {
    const intent = options.intent === 'download' ? 'download' : 'view'
    assertPermission(intent)
    const path = normalizePath(inputPath)
    const providedSign = String(options.sign || '').trim()
    const data = await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/get',
      body: {
        path,
        password: options.password || '',
      },
    })

    const upstreamSign = String(data?.sign || '')
    const sign = upstreamSign || providedSign
    const rawUrl = String(data?.raw_url || data?.rawUrl || '') || (sign ? buildSignedRawUrl(path, sign) : '')
    return {
      path,
      name: path === '/' ? '/' : path.split('/').filter(Boolean).pop() || path,
      rawUrl,
      resolvedUrl: rawUrl,
      provider: String(data?.provider || ''),
      sign,
      thumb: String(data?.thumb || ''),
      type: normalizeFileType(data?.type, path, Boolean(data?.is_dir)),
      size: Number(data?.size || 0),
      sizeLabel: formatBytes(data?.size || 0),
      modified: String(data?.modified || data?.updated_at || ''),
      isDir: Boolean(data?.is_dir),
      related: data,
    }
  }

  async function getLatestSign(requestId, inputPath, options = {}) {
    const path = normalizePath(inputPath)
    if (path === '/') {
      return ''
    }

    const parentPath = getParentPath(path) || '/'
    const pageSize = 200
    let page = 1

    while (true) {
      const data = await requestUpstream({
        requestId,
        method: 'POST',
        path: '/api/fs/list',
        body: {
          path: parentPath,
          password: options.password || '',
          page,
          per_page: pageSize,
          refresh: true,
        },
      })

      const content = Array.isArray(data?.content) ? data.content : []
      const matched = content.find((item) => {
        const entryPath = item?.path ? normalizePath(item.path) : joinPath(parentPath, String(item?.name || ''))
        return entryPath === path
      })

      if (matched) {
        return String(matched?.sign || '').trim()
      }

      const total = Number(data?.total || content.length)
      if (content.length === 0 || page * pageSize >= total) {
        break
      }

      page += 1
    }

    return ''
  }

  async function getResolvedItem(requestId, inputPath, options = {}) {
    const item = await getItem(requestId, inputPath, options)
    if (item.isDir) {
      return item
    }

    const latestSign = await getLatestSign(requestId, inputPath, options)
    const signedRawUrl = latestSign ? buildSignedRawUrl(inputPath, latestSign) : item.rawUrl
    const resolvedUrl = signedRawUrl ? await resolveDirectUrl(requestId, signedRawUrl) : ''

    if (latestSign) {
      return {
        ...item,
        sign: latestSign,
        rawUrl: signedRawUrl,
        resolvedUrl: resolvedUrl || signedRawUrl,
      }
    }

    return {
      ...item,
      resolvedUrl: resolvedUrl || item.rawUrl,
    }
  }

  async function search(requestId, { parent = defaultRoot, keywords = '', page = DEFAULT_PAGE, perPage = DEFAULT_PER_PAGE } = {}) {
    assertPermission('view')
    const normalizedParent = normalizePath(parent)
    const query = String(keywords || '').trim()
    if (!query) {
      return {
        parentPath: normalizedParent,
        total: 0,
        items: [],
      }
    }
    const currentPage = Math.max(1, Number(page || DEFAULT_PAGE))
    const pageSize = Math.max(1, Number(perPage || DEFAULT_PER_PAGE))
    const entries = await listDirectoryEntriesAllPages(requestId, normalizedParent)
    const matchedEntries = entries
      .map((entry) => ({
        entry,
        score: getSearchScore(entry, query),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score
        }

        if (left.entry.isDir !== right.entry.isDir) {
          return left.entry.isDir ? -1 : 1
        }

        return left.entry.name.localeCompare(right.entry.name, 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        })
      })

    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return {
      parentPath: normalizedParent,
      total: matchedEntries.length,
      items: matchedEntries.slice(startIndex, endIndex).map((item) => item.entry),
    }
  }

  async function makeDirectory(requestId, inputPath) {
    assertPermission('mkdir')
    const path = normalizePath(inputPath)
    const name = sanitizeName(path.split('/').pop())
    if (!name) {
      const error = new Error('Missing folder name')
      error.status = 400
      throw error
    }

    await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/mkdir',
      body: { path },
    })

    return {
      ok: true,
      path,
    }
  }

  async function rename(requestId, inputPath, nextName) {
    assertPermission('rename')
    const path = normalizePath(inputPath)
    const name = sanitizeName(nextName)
    if (!name) {
      const error = new Error('Missing new name')
      error.status = 400
      throw error
    }

    await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/rename',
      body: {
        path,
        name,
      },
    })

    return {
      ok: true,
      path,
      nextPath: joinPath(getParentPath(path) || '/', name),
    }
  }

  async function remove(requestId, dir, names) {
    assertPermission('remove')
    const normalizedDir = normalizePath(dir || '/')
    const normalizedNames = Array.isArray(names)
      ? names.map((item) => sanitizeName(item)).filter(Boolean)
      : []

    if (normalizedNames.length === 0) {
      const error = new Error('Missing names')
      error.status = 400
      throw error
    }

    await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/remove',
      body: {
        dir: normalizedDir,
        names: normalizedNames,
      },
    })

    return {
      ok: true,
      dir: normalizedDir,
      names: normalizedNames,
    }
  }

  async function move(requestId, srcDir, dstDir, names) {
    assertPermission('move')
    const normalizedNames = Array.isArray(names)
      ? names.map((item) => sanitizeName(item)).filter(Boolean)
      : []

    if (normalizedNames.length === 0) {
      const error = new Error('Missing names')
      error.status = 400
      throw error
    }

    await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/move',
      body: {
        src_dir: normalizePath(srcDir || '/'),
        dst_dir: normalizePath(dstDir || '/'),
        names: normalizedNames,
      },
    })

    return { ok: true }
  }

  async function copy(requestId, srcDir, dstDir, names) {
    assertPermission('copy')
    const normalizedNames = Array.isArray(names)
      ? names.map((item) => sanitizeName(item)).filter(Boolean)
      : []

    if (normalizedNames.length === 0) {
      const error = new Error('Missing names')
      error.status = 400
      throw error
    }

    await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/copy',
      body: {
        src_dir: normalizePath(srcDir || '/'),
        dst_dir: normalizePath(dstDir || '/'),
        names: normalizedNames,
      },
    })

    return { ok: true }
  }

  async function upload(requestId, req, { path = defaultRoot, asTask = false } = {}) {
    assertPermission('upload')
    const targetPath = normalizePath(path)
    const contentType = String(req.headers['content-type'] || '').trim()
    if (!contentType) {
      const error = new Error('Missing multipart content-type')
      error.status = 400
      throw error
    }

    const bodyStream = new PassThrough()
    req.pipe(bodyStream)

    const headers = {
      'Content-Type': contentType,
      'File-Path': targetPath,
      'As-Task': asTask ? 'true' : 'false',
    }

    const contentLength = req.headers['content-length']
    if (contentLength) {
      headers['Content-Length'] = String(contentLength)
    }

    const data = await requestUpstream({
      requestId,
      method: 'PUT',
      path: '/api/fs/form',
      body: bodyStream,
      headers,
      responseType: 'json',
    })

    return {
      ok: true,
      path: targetPath,
      data,
    }
  }

  async function getRawUrl(requestId, inputPath, options = {}) {
    const intent = options.intent === 'view' ? 'view' : 'download'
    assertPermission(intent)
    const data = await getResolvedItem(requestId, inputPath, { intent })
    if (!data.rawUrl) {
      const error = new Error('This file did not return a raw download URL')
      error.status = 404
      throw error
    }

    return data.rawUrl
  }

  return {
    normalizePath,
    joinPath,
    getPublicConfig,
    getStatus,
    listDirectory,
    getItem,
    getResolvedItem,
    search,
    makeDirectory,
    rename,
    remove,
    move,
    copy,
    upload,
    getRawUrl,
    buildSignedRawUrl,
  }
}
