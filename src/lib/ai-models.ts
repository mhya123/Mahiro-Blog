import { SITE_API_BASE_URL } from '@/consts'
import localRegistry from '../../scripts/ai-models.json'

export type AiModelDefinition = {
  id: string
  name: string
  brand: string
  capabilities?: string[]
  supportsReasoning?: boolean
  supportsVision?: boolean
}

type AiModelRegistry = {
  models: AiModelDefinition[]
}

export async function loadAiModelRegistry(): Promise<AiModelRegistry> {
  try {
    const response = await fetch(`${SITE_API_BASE_URL}/api/ai/models`, { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      return { models: Array.isArray(data.models) ? data.models : [] }
    }
  } catch { /* 服务端不可用，降级到本地 */ }

  return loadLocalAiModels()
}

export function loadLocalAiModels(): AiModelRegistry {
  return { models: Array.isArray(localRegistry.models) ? localRegistry.models : [] }
}

export async function getAiModels(): Promise<AiModelDefinition[]> {
  const resolvedRegistry = await loadAiModelRegistry()
  return resolvedRegistry.models
}

export async function findAiModelById(
  id: string | undefined | null,
): Promise<AiModelDefinition | undefined> {
  if (!id) return undefined
  const models = await getAiModels()
  return models.find((model) => model.id === id)
}
