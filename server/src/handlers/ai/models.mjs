import { t } from '../../core/locales.mjs'
import { getAiRegistry, getTranslationRegistry } from './config.mjs'

export function createModelsHandlers({ log, json, readJsonBody, driveCrypto }) {
  function secureJson(res, status, aesKey, body, origin) {
    return json(res, status, driveCrypto.encryptResponse(aesKey, body), origin)
  }

  async function handleAiModels(req, res, origin) {
    try {
      const envelope = await readJsonBody(req)
      const secureRequest = driveCrypto.decryptEnvelope(envelope)
      return secureJson(res, 200, secureRequest.aesKey, getAiRegistry(), origin)
    } catch (error) {
      log('WARNING', 'Invalid AI models request', {
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid encrypted AI models request' }, origin)
    }
  }

  async function handleTranslationModels(req, res, origin) {
    try {
      const envelope = await readJsonBody(req)
      const secureRequest = driveCrypto.decryptEnvelope(envelope)
      return secureJson(res, 200, secureRequest.aesKey, getTranslationRegistry(), origin)
    } catch (error) {
      log('WARNING', 'Invalid Translation models request', {
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid encrypted Translation models request' }, origin)
    }
  }

  return { handleAiModels, handleTranslationModels }
}
