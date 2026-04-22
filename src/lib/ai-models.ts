import registry from '../../scripts/ai-models.json'

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
  const parsed = registry as AiModelRegistry
  return {
    models: Array.isArray(parsed.models) ? parsed.models : [],
  }
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
