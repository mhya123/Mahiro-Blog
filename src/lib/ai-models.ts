import { readFile } from 'node:fs/promises'

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
  const filePath = new URL('../../scripts/ai-models.json', import.meta.url)
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as AiModelRegistry
  return {
    models: Array.isArray(parsed.models) ? parsed.models : [],
  }
}

export async function getAiModels(): Promise<AiModelDefinition[]> {
  const registry = await loadAiModelRegistry()
  return registry.models
}

export async function findAiModelById(id: string | undefined | null): Promise<AiModelDefinition | undefined> {
  if (!id) return undefined
  const models = await getAiModels()
  return models.find((model) => model.id === id)
}
