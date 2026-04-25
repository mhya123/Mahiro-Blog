import { getParentPath, joinPath, normalizePath } from './alist-paths.mjs'

export function formatBytes(value) {
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

export function inferFileType(name) {
  const lowerName = String(name || '').toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/.test(lowerName)) return 'image'
  if (/\.(mp4|webm|flv|mkv|mov|avi|wmv|m4v|rmvb|rm|mpeg|mpg|3gp)$/.test(lowerName)) return 'video'
  if (/\.(mp3|aac|ogg|wma|flac|alac|m4a|ape|wav|aiff|midi|mid|amr)$/.test(lowerName)) return 'audio'
  if (/\.(pdf)$/.test(lowerName)) return 'pdf'
  if (/\.(txt|md|rtf|doc|docx|odt|pages|json|csv|xml|ya?ml|toml|ini|conf|cfg|log|html|css|js|ts|jsx|tsx|astro|py|java|php|sh|bat|sql|mdx|scss|ps1|go|rs|c|cpp|h)$/.test(lowerName)) return 'text'
  if (/\.(zip|7z|rar|tar|gz|bz2|xz)$/.test(lowerName)) return 'archive'
  return 'file'
}

export function normalizeFileType(rawType, name, isDir = false) {
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

export function normalizeEntry(item, parentPath = '/') {
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

export function sortEntries(entries) {
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
