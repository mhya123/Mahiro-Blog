/**
 * @file rate-limiter.mjs
 * @description 基于滑动窗口的轻量级请求速率限制。
 *
 * 架构：
 *   - 全局限制：所有请求统一受控（RATE_LIMIT_MAX，默认 60 次/窗口）
 *   - 路由规则：通过 addRule() 为特定路径注册额外限制，与全局限制叠加
 *   - check() 先查全局，再查所有匹配的路由规则，任一超限即拒绝
 *
 * 环境变量：
 *   RATE_LIMIT_ENABLED     - 是否启用（默认 true）
 *   RATE_LIMIT_WINDOW_MS   - 窗口大小 ms（默认 60000）
 *   RATE_LIMIT_MAX         - 每窗口 IP 全局最大请求数（默认 60）
 */

let instances = 0
let interval = null

function now() {
  return Date.now()
}

/**
 * @param {string} ip
 * @param {string} pathname
 * @param {Map<string,{count:number,resetAt:number}>} counters
 * @param {number} max
 * @param {number} windowMs
 * @param {number} nowTs
 * @returns {{ allowed: boolean, remaining: number, reset: number, retryAfter: number }}
 */
function checkCounter(counters, key, max, windowMs, nowTs) {
  let entry = counters.get(key)

  if (!entry || entry.resetAt <= nowTs) {
    entry = { count: 1, resetAt: nowTs + windowMs }
    counters.set(key, entry)
    return { allowed: true, remaining: max - 1, reset: entry.resetAt, retryAfter: 0 }
  }

  entry.count += 1

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - nowTs) / 1000)
    return { allowed: false, remaining: 0, reset: entry.resetAt, retryAfter }
  }

  return { allowed: true, remaining: max - entry.count, reset: entry.resetAt, retryAfter: 0 }
}

/**
 * @param {string} pathname
 * @param {string} pattern - 前缀匹配，例如 '/api/ai/' 匹配所有 AI 路由
 */
function pathMatches(pathname, pattern) {
  return pathname.startsWith(pattern)
}

export function createRateLimiter({
  enabled = (process.env.RATE_LIMIT_ENABLED || 'true') !== 'false',
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  globalMax = Number(process.env.RATE_LIMIT_MAX || 60),
} = {}) {
  const counters = new Map()
  const routeRules = new Map()

  function cleanup() {
    const cutoff = now() - windowMs
    for (const [key, entry] of counters) {
      if (entry.resetAt <= cutoff) {
        counters.delete(key)
      }
    }
  }

  instances += 1
  if (!interval) {
    interval = setInterval(cleanup, Math.max(windowMs / 4, 10_000))
    interval.unref()
  }

  /**
   * 为指定路由模式注册独立限制。
   * @param {string} pattern - 路径前缀，如 '/api/ai/' 或 '/api/drive/upload'
   * @param {{ max: number, windowMs?: number }} options
   */
  function addRule(pattern, { max, windowMs: ruleWindowMs } = {}) {
    if (!pattern || typeof max !== 'number' || max < 1) {
      throw new Error('addRule requires a path pattern and a positive max')
    }
    routeRules.set(pattern, { max, windowMs: ruleWindowMs || windowMs })
  }

  /**
   * 移除路由规则。
   * @param {string} pattern
   */
  function removeRule(pattern) {
    routeRules.delete(pattern)
  }

  /**
   * @param {string} ip
   * @param {string} pathname
   * @returns {{ allowed: boolean, remaining: number, reset: number, retryAfter: number }}
   */
  function check(ip, pathname) {
    if (!enabled) return { allowed: true, remaining: Infinity, reset: 0, retryAfter: 0 }

    const nowTs = now()

    // 1. 全局限制
    const globalKey = `${ip}:__global__`
    const globalResult = checkCounter(counters, globalKey, globalMax, windowMs, nowTs)
    if (!globalResult.allowed) {
      return globalResult
    }

    // 2. 路由级限制（与全局叠加，任一触发即拒绝）
    let minRemaining = globalResult.remaining
    let latestReset = globalResult.reset

    for (const [pattern, rule] of routeRules) {
      if (pathMatches(pathname, pattern)) {
        const routeKey = `${ip}:route:${pattern}`
        const routeResult = checkCounter(counters, routeKey, rule.max, rule.windowMs, nowTs)
        if (!routeResult.allowed) {
          return routeResult
        }
        minRemaining = Math.min(minRemaining, routeResult.remaining)
        latestReset = Math.max(latestReset, routeResult.reset)
      }
    }

    return { allowed: true, remaining: minRemaining, reset: latestReset, retryAfter: 0 }
  }

  /**
   * 销毁实例（测试用）
   */
  function destroy() {
    instances -= 1
    if (instances <= 0 && interval) {
      clearInterval(interval)
      interval = null
    }
    counters.clear()
    routeRules.clear()
  }

  return { addRule, removeRule, check, destroy }
}
