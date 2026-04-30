/**
 * @file alist-operations.mjs
 * @description AList 网盘业务操作层。
 *
 * 所有读操作（list / item / search）走 Redis 缓存，写操作（mkdir / rename / remove / move / copy / upload）
 * 完成后自动清除受影响路径的缓存，保证数据一致性。
 */

import { PassThrough } from 'node:stream'
import { formatBytes, normalizeEntry, normalizeFileType, sortEntries } from './entries.mjs'
import { DEFAULT_PAGE, DEFAULT_PER_PAGE } from './config.mjs'
import { getParentPath, joinPath, normalizePath, sanitizeName } from './paths.mjs'
import { getSearchScore } from './search.mjs'

// ── 缓存 TTL（秒）──
const LIST_CACHE_TTL = 60      // 目录列表 60 秒
const ITEM_CACHE_TTL = 120     // 文件详情 120 秒
const SEARCH_CACHE_TTL = 30    // 搜索结果 30 秒

function assertPermission(permissions, permission) {
  if (permissions[permission] !== false) {
    return
  }

  const error = new Error(`Drive permission denied: ${permission}`)
  error.status = 403
  throw error
}

/**
 * 构建缓存 key
 */
function listCacheKey(path, page, perPage) {
  return `alist:list:${path}:${page}:${perPage}`
}

function itemCacheKey(path) {
  return `alist:item:${path}`
}

function searchCacheKey(parent, keywords) {
  return `alist:search:${parent}:${keywords}`
}

export function createAListOperations({
  log,
  defaultRoot,
  permissions,
  requestUpstream,
  getAccessToken,
  buildSignedRawUrl,
  resolveDirectUrl,
  cache, // Redis 缓存实例
}) {
  /**
   * 清除某个路径相关的所有读缓存
   */
  async function invalidatePath(path) {
    if (!cache) return
    const normalizedPath = normalizePath(path)
    try {
      await Promise.all([
        cache.delByPrefix(`alist:list:${normalizedPath}`),
        cache.del(itemCacheKey(normalizedPath)),
        cache.delByPrefix('alist:search:'),
      ])
    } catch {
      // 清缓存失败不阻塞业务
    }
  }

  /**
   * 清除路径本身和父目录的缓存（写操作是在某个目录下新增/修改条目）
   */
  async function invalidatePathAndParent(path) {
    if (!cache) return
    const normalizedPath = normalizePath(path)
    const parentPath = getParentPath(normalizedPath) || '/'
    await Promise.all([
      invalidatePath(normalizedPath),
      invalidatePath(parentPath),
    ])
  }

  async function getStatus(requestId, publicConfig) {
    if (!publicConfig.configured) {
      return {
        ...publicConfig,
        connected: false,
      }
    }

    try {
      await getAccessToken(requestId)
      return {
        ...publicConfig,
        connected: true,
      }
    } catch (error) {
      log('ERROR', 'AList status check failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        ...publicConfig,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async function listDirectory(requestId, inputPath = defaultRoot, options = {}) {
    assertPermission(permissions, 'view')
    const path = normalizePath(inputPath)
    const page = Number(options.page || DEFAULT_PAGE)
    const perPage = Number(options.perPage || DEFAULT_PER_PAGE)
    const refresh = Boolean(options.refresh)

    // 读缓存（refresh=true 时跳过）
    if (!refresh && cache) {
      const cached = await cache.getJson(listCacheKey(path, page, perPage))
      if (cached) {
        log('INFO', 'Drive list cache hit', { requestId, path, page, perPage })
        return cached
      }
    }

    const data = await requestUpstream({
      requestId,
      method: 'POST',
      path: '/api/fs/list',
      body: {
        path,
        password: options.password || '',
        page,
        per_page: perPage,
        refresh,
      },
    })

    const content = Array.isArray(data?.content) ? data.content : []
    const result = {
      path,
      parentPath: getParentPath(path),
      total: Number(data?.total || content.length),
      readme: typeof data?.readme === 'string' ? data.readme : '',
      write: Boolean(data?.write),
      provider: String(data?.provider || ''),
      items: sortEntries(content.map((item) => normalizeEntry(item, path))),
    }

    // 写缓存
    if (cache) {
      await cache.setJson(listCacheKey(path, page, perPage), result, LIST_CACHE_TTL)
    }

    return result
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
    assertPermission(permissions, intent)
    const path = normalizePath(inputPath)

    // 读缓存
    if (cache) {
      const cached = await cache.getJson(itemCacheKey(path))
      if (cached) {
        log('INFO', 'Drive item cache hit', { requestId, path })
        return cached
      }
    }

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
    const result = {
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

    // 写缓存
    if (cache) {
      await cache.setJson(itemCacheKey(path), result, ITEM_CACHE_TTL)
    }

    return result
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
    assertPermission(permissions, 'view')
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

    // 读搜索缓存（含分页参数的完整 key）
    const cacheKey = `${searchCacheKey(normalizedParent, query)}:${currentPage}:${pageSize}`
    if (cache) {
      const cached = await cache.getJson(cacheKey)
      if (cached) {
        log('INFO', 'Drive search cache hit', { requestId, parent: normalizedParent, query })
        return cached
      }
    }

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
    const result = {
      parentPath: normalizedParent,
      total: matchedEntries.length,
      items: matchedEntries.slice(startIndex, endIndex).map((item) => item.entry),
    }

    // 写搜索缓存
    if (cache) {
      await cache.setJson(cacheKey, result, SEARCH_CACHE_TTL)
    }

    return result
  }

  // ── 写入操作：执行后清除相关缓存 ──

  async function makeDirectory(requestId, inputPath) {
    assertPermission(permissions, 'mkdir')
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

    await invalidatePathAndParent(path)

    return {
      ok: true,
      path,
    }
  }

  async function rename(requestId, inputPath, nextName) {
    assertPermission(permissions, 'rename')
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

    await invalidatePathAndParent(path)

    return {
      ok: true,
      path,
      nextPath: joinPath(getParentPath(path) || '/', name),
    }
  }

  async function remove(requestId, dir, names) {
    assertPermission(permissions, 'remove')
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

    await invalidatePath(normalizedDir)

    return {
      ok: true,
      dir: normalizedDir,
      names: normalizedNames,
    }
  }

  async function move(requestId, srcDir, dstDir, names) {
    assertPermission(permissions, 'move')
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

    await Promise.all([
      invalidatePath(normalizePath(srcDir || '/')),
      invalidatePath(normalizePath(dstDir || '/')),
    ])

    return { ok: true }
  }

  async function copy(requestId, srcDir, dstDir, names) {
    assertPermission(permissions, 'copy')
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

    await invalidatePath(normalizePath(dstDir || '/'))

    return { ok: true }
  }

  async function upload(requestId, req, { path = defaultRoot, asTask = false } = {}) {
    assertPermission(permissions, 'upload')
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

    await invalidatePath(targetPath)

    return {
      ok: true,
      path: targetPath,
      data,
    }
  }

  async function getRawUrl(requestId, inputPath, options = {}) {
    const intent = options.intent === 'view' ? 'view' : 'download'
    assertPermission(permissions, intent)
    const data = await getResolvedItem(requestId, inputPath, { intent })
    if (!data.rawUrl) {
      const error = new Error('This file did not return a raw download URL')
      error.status = 404
      throw error
    }

    return data.rawUrl
  }

  return {
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
  }
}
