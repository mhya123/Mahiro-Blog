import { readFile } from 'node:fs/promises'

export type TranslationModelDefinition = {
  id: string
  name: string
  brand: string
  capabilities?: string[]
  supportsReasoning?: boolean
}

type TranslationModelRegistry = {
  models: TranslationModelDefinition[]
}

export async function loadTranslationModelRegistry(): Promise<TranslationModelRegistry> {
  const filePath = new URL('../../scripts/translation-models.json', import.meta.url)
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as TranslationModelRegistry
  return {
    models: Array.isArray(parsed.models) ? parsed.models : [],
  }
}

export async function getTranslationModels(): Promise<TranslationModelDefinition[]> {
  const registry = await loadTranslationModelRegistry()
  return registry.models
}

export async function findTranslationModelById(id: string | undefined | null): Promise<TranslationModelDefinition | undefined> {
  if (!id) return undefined
  const models = await getTranslationModels()
  return models.find((model) => model.id === id)
}
