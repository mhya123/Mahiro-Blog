import { SITE_API_BASE_URL } from '@/consts'
import { secureApiRequest } from './secure-api'
import localAiRegistry from '../../scripts/ai-models.json'

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
  try {
    const data = await secureApiRequest<TranslationModelRegistry>('/api/ai/translation-models', {})
    return { models: Array.isArray(data.models) ? data.models : [] }
  } catch {
    return { models: Array.isArray(localAiRegistry.models) ? localAiRegistry.models : [] }
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
