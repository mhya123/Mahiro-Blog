import { t, getLogLang } from './locales.mjs'

function now() {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// ── ANSI 颜色 ──
const c = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[90m',
  red:      '\x1b[31m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  blue:     '\x1b[34m',
  cyan:     '\x1b[36m',
  magenta:  '\x1b[35m',
  bgRed:    '\x1b[41m',
  bgYellow: '\x1b[43m',
  white:    '\x1b[37m',
}

// ── 级别样式映射 ──
const levelStyles = {
  INFO:  { color: c.green,  icon: '✓', label: 'INFO ' },
  WARN:  { color: c.yellow, icon: '⚠', label: 'WARN ' },
  ERROR: { color: c.red,    icon: '✗', label: 'ERROR' },
  DEBUG: { color: c.cyan,   icon: '…', label: 'DEBUG' },
}

/**
 * 将 meta 对象格式化为可读的键值对（带颜色）
 */
function formatMeta(meta = {}) {
  const entries = Object.entries(meta).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''

  const parts = entries.map(([key, value]) => {
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return `${c.dim}${key}${c.reset}${c.dim}=${c.reset}${c.cyan}${displayValue}${c.reset}`
  })

  return `\n  ${c.dim}↳${c.reset} ${parts.join(`${c.dim} · ${c.reset}`)}`
}

export function createLogger({ logPrefix = 'server' } = {}) {
  // 启动时打印语言提示
  const lang = getLogLang()
  const langHint = t('log_lang_hint')
  console.log(`${c.dim}${now()}${c.reset} ${c.dim}[${logPrefix}]${c.reset} ${c.blue}ℹ${c.reset} ${langHint} ${c.dim}(LOG_LANG=${lang})${c.reset}`)

  function log(level, message, meta) {
    const style = levelStyles[level] || levelStyles.INFO
    const time  = `${c.dim}${now()}${c.reset}`
    const tag   = `${c.dim}[${logPrefix}]${c.reset}`
    const badge = `${style.color}${style.icon} ${style.label}${c.reset}`
    const msg   = level === 'ERROR'
      ? `${c.red}${c.bold}${message}${c.reset}`
      : level === 'WARN'
        ? `${c.yellow}${message}${c.reset}`
        : message
    const line  = `${time} ${tag} ${badge} ${msg}${formatMeta(meta)}`

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
    t,
    createRequestId,
    getClientIp,
  }
}

export { t }
