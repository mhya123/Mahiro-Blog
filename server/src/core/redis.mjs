/**
 * @file redis.mjs
 * @description Redis 缓存抽象层。
 *
 * 提供统一的缓存读写接口，当 Redis 不可用时优雅降级到进程内 Map 缓存。
 * 对上层业务完全透明——无论底层使用 Redis 还是内存，API 行为一致。
 */

import Redis from 'ioredis'

const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379'

/**
 * 内存降级缓存实现
 * 当 Redis 不可用时自动启用，保持接口兼容。
 * 使用 TTL 机制定期清理过期 key，防止内存泄漏。
 */
function createMemoryFallback(log) {
  const store = new Map()
  const timers = new Map()

  log('WARN', 'Redis unavailable — using in-memory cache fallback')

  function cleanup(key) {
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  return {
    isRedis: false,
    isReady: true,

    async get(key) {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key)
        cleanup(key)
        return null
      }
      return entry.value
    },

    async set(key, value, ttlSeconds) {
      cleanup(key)
      const entry = { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 }
      store.set(key, entry)
      if (ttlSeconds) {
        timers.set(key, setTimeout(() => {
          store.delete(key)
          timers.delete(key)
        }, ttlSeconds * 1000))
      }
    },

    async del(key) {
      cleanup(key)
      store.delete(key)
    },

    async delByPrefix(prefix) {
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) {
          cleanup(k)
          store.delete(k)
        }
      }
    },

    async getJson(key) {
      const raw = await this.get(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },

    async setJson(key, value, ttlSeconds) {
      await this.set(key, JSON.stringify(value), ttlSeconds)
    },

    async quit() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      store.clear()
    },

    getStats() {
      return { backend: 'memory', keys: store.size }
    },
  }
}

/**
 * 创建 Redis 缓存实例
 *
 * @param {object} options
 * @param {Function} options.log    - 日志函数 (level, message, meta)
 * @param {string} [options.url]    - Redis 连接 URL，例如 redis://:pw@host:6379/0
 * @param {string} [options.prefix] - 缓存 key 前缀，默认 'mahiro:'
 * @returns {{ get, set, del, delByPrefix, getJson, setJson, quit, isRedis, isReady, getStats }}
 */
export function createRedisCache({ log, url, prefix = 'mahiro:' } = {}) {
  const redisUrl = url || process.env.REDIS_URL || DEFAULT_REDIS_URL
  const keyPrefix = prefix || process.env.REDIS_KEY_PREFIX || 'mahiro:'

  let client
  let ready = false
  let fallback = null

  function prefixKey(key) {
    return `${keyPrefix}${key}`
  }

  // 尝试连接 Redis
  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        // 重连退避策略：500ms → 1s → 2s → 最大 10s
        const delay = Math.min(times * 500, 10_000)
        log('WARN', 'Redis reconnecting', { attempt: times, delayMs: delay })
        return delay
      },
      lazyConnect: false,
      enableReadyCheck: true,
      connectTimeout: 5000,
    })

    client.on('connect', () => {
      log('INFO', 'Redis connected', { url: redisUrl.replace(/\/\/.*@/, '//<credentials>@') })
    })

    client.on('ready', () => {
      ready = true
      log('INFO', 'Redis ready')
    })

    client.on('error', (err) => {
      log('ERROR', 'Redis error', { error: err.message })
    })

    client.on('close', () => {
      ready = false
    })
  } catch (err) {
    log('ERROR', 'Redis initialization failed, falling back to memory', { error: err.message })
    fallback = createMemoryFallback(log)
  }

  /**
   * 获取底层有效实例（Redis 或降级内存）
   * 如果 Redis 连接断开，自动降级到内存缓存
   */
  function getBackend() {
    if (fallback) return fallback
    if (!client || !ready) {
      if (!fallback) {
        fallback = createMemoryFallback(log)
      }
      return fallback
    }
    return null // 使用 Redis
  }

  const cache = {
    get isRedis() {
      return !getBackend()
    },

    get isReady() {
      return ready || Boolean(fallback?.isReady)
    },

    async get(key) {
      const backend = getBackend()
      if (backend) return backend.get(key)
      try {
        return await client.get(prefixKey(key))
      } catch (err) {
        log('WARN', 'Redis GET failed', { key, error: err.message })
        return null
      }
    },

    async set(key, value, ttlSeconds) {
      const backend = getBackend()
      if (backend) return backend.set(key, value, ttlSeconds)
      try {
        const pk = prefixKey(key)
        if (ttlSeconds) {
          await client.set(pk, value, 'EX', ttlSeconds)
        } else {
          await client.set(pk, value)
        }
      } catch (err) {
        log('WARN', 'Redis SET failed', { key, error: err.message })
      }
    },

    async del(key) {
      const backend = getBackend()
      if (backend) return backend.del(key)
      try {
        await client.del(prefixKey(key))
      } catch (err) {
        log('WARN', 'Redis DEL failed', { key, error: err.message })
      }
    },

    async delByPrefix(keyPattern) {
      const backend = getBackend()
      if (backend) return backend.delByPrefix(keyPattern)
      try {
        const fullPattern = prefixKey(keyPattern) + '*'
        let cursor = '0'
        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
          cursor = nextCursor
          if (keys.length > 0) {
            await client.del(...keys)
          }
        } while (cursor !== '0')
      } catch (err) {
        log('WARN', 'Redis SCAN+DEL failed', { keyPattern, error: err.message })
      }
    },

    async getJson(key) {
      const raw = await cache.get(key)
      if (raw === null || raw === undefined) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },

    async setJson(key, value, ttlSeconds) {
      await cache.set(key, JSON.stringify(value), ttlSeconds)
    },

    async quit() {
      if (fallback) {
        await fallback.quit()
        return
      }
      try {
        await client?.quit()
      } catch {
        // ignore
      }
    },

    getStats() {
      const backend = getBackend()
      if (backend) return backend.getStats()
      return { backend: 'redis', ready, url: redisUrl.replace(/\/\/.*@/, '//<credentials>@') }
    },
  }

  return cache
}
