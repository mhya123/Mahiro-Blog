import { t } from '../../core/locales.mjs'

export function createSecureHandlers({ log, json, readJsonBody, driveCrypto, runSummaryPayload, runTranslatePayload }) {
  function secureJson(res, status, aesKey, body, origin) {
    return json(res, status, driveCrypto.encryptResponse(aesKey, body), origin)
  }

  async function handleSecureAi(req, res, origin) {
    let secureRequest

    try {
      const envelope = await readJsonBody(req)
      secureRequest = driveCrypto.decryptEnvelope(envelope)
    } catch (error) {
      log('WARN', t('ai_encrypted_rejected'), {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid encrypted AI request' }, origin)
    }

    const action = String(secureRequest.payload?.action || '')
    const payload = secureRequest.payload?.payload && typeof secureRequest.payload.payload === 'object'
      ? secureRequest.payload.payload
      : {}
      
    const result = action === 'summary'
      ? await runSummaryPayload(req.requestId, payload)
      : action === 'translate'
        ? await runTranslatePayload(req.requestId, payload)
        : { status: 404, body: { error: 'Unknown secure AI action' } }

    return secureJson(res, result.status, secureRequest.aesKey, result.body, origin)
  }

  return { handleSecureAi }
}
