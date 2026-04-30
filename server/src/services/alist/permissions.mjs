const DRIVE_PERMISSION_KEYS = ['upload', 'mkdir', 'view', 'download', 'rename', 'copy', 'move', 'remove']

export function buildDefaultPermissions() {
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

export function parsePermissions(rawValue) {
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
