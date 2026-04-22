import registry from '../../scripts/translation-models.json'

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
  const parsed = registry as TranslationModelRegistry
  return {
    models: Array.isArray(parsed.models) ? parsed.models : [],
  }
}

export async function getTranslationModels(): Promise<TranslationModelDefinition[]> {
  const resolvedRegistry = await loadTranslationModelRegistry()
  return resolvedRegistry.models
}

export async function findTranslationModelById(
  id: string | undefined | null,
): Promise<TranslationModelDefinition | undefined> {
  if (!id) return undefined
  const models = await getTranslationModels()
  return models.find((model) => model.id === id)
}
