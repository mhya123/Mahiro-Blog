import { parsePermissions } from './alist-permissions.mjs'
import { normalizePath } from './alist-paths.mjs'

export const DEFAULT_ALIST_BASE_URL = 'https://s.mahiro.work'
export const DEFAULT_TIMEOUT_MS = 45_000
export const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
export const DEFAULT_REDIRECT_CACHE_TTL_MS = 10 * 60 * 1000
export const DEFAULT_PAGE = 1
export const DEFAULT_PER_PAGE = 200

export function readAListConfigFromEnv(defaultTimeoutMs = DEFAULT_TIMEOUT_MS) {
  return {
    baseUrl: (process.env.ALIST_BASE_URL || DEFAULT_ALIST_BASE_URL).replace(/\/+$/, ''),
    username: String(process.env.ALIST_USERNAME || '').trim(),
    password: String(process.env.ALIST_PASSWORD || '').trim(),
    staticToken: String(process.env.ALIST_TOKEN || '').trim(),
    defaultRoot: normalizePath(process.env.ALIST_ROOT_PATH || '/'),
    requestTimeoutMs: Number(process.env.ALIST_TIMEOUT_MS || defaultTimeoutMs || DEFAULT_TIMEOUT_MS),
    permissions: parsePermissions(process.env.ALIST_PERMISSIONS),
    redirectCacheTtlMs: Number(process.env.ALIST_REDIRECT_CACHE_TTL_MS || DEFAULT_REDIRECT_CACHE_TTL_MS),
  }
}

export function buildAListPublicConfig({ baseUrl, defaultRoot, permissions, staticToken, username, isConfigured }) {
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
    authMode: staticToken ? 'token' : username && username.trim() ? 'credentials' : 'none',
    username: username || null,
    permissions,
  }
}
