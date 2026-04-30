/**
 * @file alist.mjs
 * @description AList 网盘服务工厂，组装上游通信层和业务操作层。
 */

import { buildAListPublicConfig, DEFAULT_TIMEOUT_MS, DEFAULT_TOKEN_TTL_MS, readAListConfigFromEnv } from './config.mjs'
import { createAListOperations } from './operations.mjs'
import { joinPath, normalizePath } from './paths.mjs'
import { createAListUpstream } from './upstream.mjs'

export function createAListService({ log, defaultTimeoutMs = DEFAULT_TIMEOUT_MS, cache }) {
  const config = readAListConfigFromEnv(defaultTimeoutMs)
  const upstream = createAListUpstream({
    log,
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password,
    staticToken: config.staticToken,
    requestTimeoutMs: config.requestTimeoutMs,
    redirectCacheTtlMs: config.redirectCacheTtlMs,
    defaultTokenTtlMs: DEFAULT_TOKEN_TTL_MS,
    cache,
  })

  const getPublicConfig = () => buildAListPublicConfig({
    baseUrl: config.baseUrl,
    defaultRoot: config.defaultRoot,
    permissions: config.permissions,
    staticToken: config.staticToken,
    username: config.username,
    isConfigured: upstream.isConfigured,
  })

  const operations = createAListOperations({
    log,
    defaultRoot: config.defaultRoot,
    permissions: config.permissions,
    requestUpstream: upstream.requestUpstream,
    getAccessToken: upstream.getAccessToken,
    buildSignedRawUrl: upstream.buildSignedRawUrl,
    resolveDirectUrl: upstream.resolveDirectUrl,
    cache,
  })

  return {
    normalizePath,
    joinPath,
    getPublicConfig,
    getStatus(requestId) {
      return operations.getStatus(requestId, getPublicConfig())
    },
    listDirectory: operations.listDirectory,
    getItem: operations.getItem,
    getResolvedItem: operations.getResolvedItem,
    search: operations.search,
    makeDirectory: operations.makeDirectory,
    rename: operations.rename,
    remove: operations.remove,
    move: operations.move,
    copy: operations.copy,
    upload: operations.upload,
    getRawUrl: operations.getRawUrl,
    buildSignedRawUrl: upstream.buildSignedRawUrl,
  }
}
