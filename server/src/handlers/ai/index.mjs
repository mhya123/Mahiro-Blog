import { createSummaryHandlers } from './summary.mjs'
import { createTranslateHandlers } from './translate.mjs'
import { createModelsHandlers } from './models.mjs'
import { createSecureHandlers } from './secure.mjs'

export function createAiHandlers(deps) {
  const summaryOpts = { ...deps }
  const summaryHandlers = createSummaryHandlers(summaryOpts)
  
  const translateOpts = { ...deps }
  const translateHandlers = createTranslateHandlers(translateOpts)
  
  const modelsOpts = { ...deps }
  const modelsHandlers = createModelsHandlers(modelsOpts)

  const secureOpts = { 
    ...deps, 
    runSummaryPayload: summaryHandlers.runSummaryPayload,
    runTranslatePayload: translateHandlers.runTranslatePayload
  }
  const secureHandlers = createSecureHandlers(secureOpts)

  return {
    handleSummary: summaryHandlers.handleSummary,
    handleTranslate: translateHandlers.handleTranslate,
    handleAiModels: modelsHandlers.handleAiModels,
    handleTranslationModels: modelsHandlers.handleTranslationModels,
    handleSecureAi: secureHandlers.handleSecureAi,
  }
}
