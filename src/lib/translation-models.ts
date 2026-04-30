import { SITE_API_BASE_URL } from '@/consts'
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
    const response = await fetch(`${SITE_API_BASE_URL}/api/ai/translation-models`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch translation models: ${response.status}`)
    }

    const data = await response.json()
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
