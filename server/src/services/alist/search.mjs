function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
}

function isSubsequenceMatch(query, target) {
  if (!query) {
    return true
  }

  let index = 0
  for (const char of target) {
    if (char === query[index]) {
      index += 1
      if (index >= query.length) {
        return true
      }
    }
  }

  return false
}

export function getSearchScore(entry, query) {
  const rawQuery = String(query || '').trim().toLowerCase()
  if (!rawQuery) {
    return Number.POSITIVE_INFINITY
  }

  const name = String(entry?.name || '').trim()
  const path = String(entry?.path || '').trim()
  const lowerName = name.toLowerCase()
  const lowerPath = path.toLowerCase()

  if (lowerName === rawQuery) return 0
  if (lowerName.startsWith(rawQuery)) return 1
  if (lowerName.includes(rawQuery)) return 2
  if (lowerPath.includes(rawQuery)) return 3

  const normalizedQuery = normalizeSearchText(rawQuery)
  const normalizedName = normalizeSearchText(name)
  const normalizedPath = normalizeSearchText(path)

  if (!normalizedQuery) return Number.POSITIVE_INFINITY
  if (normalizedName === normalizedQuery) return 4
  if (normalizedName.startsWith(normalizedQuery)) return 5
  if (normalizedName.includes(normalizedQuery)) return 6
  if (normalizedPath.includes(normalizedQuery)) return 7
  if (isSubsequenceMatch(normalizedQuery, normalizedName)) return 8
  if (isSubsequenceMatch(normalizedQuery, normalizedPath)) return 9

  return Number.POSITIVE_INFINITY
}
