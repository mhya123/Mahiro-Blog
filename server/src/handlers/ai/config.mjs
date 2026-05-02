import { readFileSync, watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createConfigLoader(filename) {
  const filePath = resolve(__dirname, '../../../config', filename)
  let cache = JSON.parse(readFileSync(filePath, 'utf8'))

  watch(filePath, () => {
    try { cache = JSON.parse(readFileSync(filePath, 'utf8')) } catch { /* 解析失败时保留旧缓存 */ }
  })

  return () => cache
}

export const getAiRegistry = createConfigLoader('ai-models.json')
export const getTranslationRegistry = createConfigLoader('translation-models.json')

export function findAiModelById(id) {
  if (!id) return undefined
  return (getAiRegistry().models || []).find((model) => model.id === id)
}

export function findTranslationModelById(id) {
  if (!id) return undefined
  return (getTranslationRegistry().models || []).find((model) => model.id === id)
}
