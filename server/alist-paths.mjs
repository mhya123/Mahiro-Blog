export function normalizePath(input = '/') {
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

export function joinPath(dir, name) {
  const base = normalizePath(dir)
  const cleanName = String(name || '').trim().replace(/^\/+|\/+$/g, '')
  if (!cleanName) {
    return base
  }

  return base === '/' ? `/${cleanName}` : `${base}/${cleanName}`
}

export function encodePathSegments(inputPath) {
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

export function getParentPath(inputPath) {
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

export function sanitizeName(value) {
  return String(value || '').trim().replace(/[\\/]/g, '')
}
