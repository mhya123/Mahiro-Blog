/**
 * @file client-ip.mjs
 * @description 从请求中提取客户端真实 IP，支持多层代理 / CDN 场景。
 *
 * 提取顺序：
 *   1. x-mahiro          — CDN / 自定义边缘代理注入的真实 IP
 *   2. x-forwarded-for   — 标准代理链（取最左侧第一个非保留地址）
 *   3. x-real-ip         — Nginx / 反向代理单跳传递
 *   4. req.socket         — 直连 IP（无代理时）
 *
 * 私有 / 保留地址段会被跳过，继续尝试下一个来源。
 */

const PRIVATE_RANGES = [
  // IPv4
  /^127\./,                            // 127.0.0.0/8
  /^10\./,                             // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,        // 172.16.0.0/12
  /^192\.168\./,                       // 192.168.0.0/16
  /^0\./,                              // 0.0.0.0/8
  // IPv6
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
]

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivate(ip) {
  if (!ip) return true
  return PRIVATE_RANGES.some((re) => re.test(ip))
}

/**
 * 从 x-forwarded-for 链中提取第一个非保留的公网 IP。
 * @param {string} header
 * @returns {string | null}
 */
function parseForwardedFor(header) {
  const ips = header.split(',').map((s) => s.trim()).filter(Boolean)
  for (const ip of ips) {
    if (!isPrivate(ip)) return ip
  }
  // 全是私有地址时退回第一个
  return ips[0] || null
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const mahiro = req.headers['x-mahiro']
  if (typeof mahiro === 'string' && mahiro.trim()) {
    return mahiro.trim()
  }

  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const ip = parseForwardedFor(forwarded)
    if (ip) return ip
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  return req.socket?.remoteAddress || 'unknown'
}
