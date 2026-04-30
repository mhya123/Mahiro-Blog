import { Readable } from 'node:stream'
import { t } from '../core/locales.mjs'

function buildDriveErrorPayload(error, fallbackMessage = 'Drive request failed') {
  return {
    error: error instanceof Error ? error.message : fallbackMessage,
    details: error?.payload || null,
  }
}

export function createDriveHandlers({
  alistService,
  driveCrypto,
  log,
  json,
  readJsonBody,
  buildCorsHeaders,
  getQueryString,
  getQueryBoolean,
  getQueryNumber,
  encodeContentDispositionFilename,
}) {
  function secureJson(res, status, aesKey, body, origin) {
    return json(res, status, driveCrypto.encryptResponse(aesKey, body), origin)
  }

  async function withJsonBody(req, res, origin, task) {
    let payload = {}

    try {
      payload = await readJsonBody(req)
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' }, origin)
    }

    return task(payload)
  }

  async function handleDriveStatus(req, res, origin) {
    const requestId = req.requestId

    try {
      const status = await alistService.getStatus(requestId)
      return json(res, 200, status, origin)
    } catch (error) {
      log('ERROR', t('drive_status_failed'), {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function withSecureBody(req, res, origin, task) {
    let secureRequest

    try {
      const envelope = await readJsonBody(req)
      secureRequest = driveCrypto.decryptEnvelope(envelope)
    } catch (error) {
      log('WARN', t('drive_encrypted_rejected'), {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return json(res, 400, buildDriveErrorPayload(error, 'Invalid encrypted drive request'), origin)
    }

    try {
      const data = await task(secureRequest.payload || {})
      return secureJson(res, 200, secureRequest.aesKey, data, origin)
    } catch (error) {
      log('ERROR', t('drive_secure_action_failed'), {
        requestId: req.requestId,
        action: secureRequest.payload?.action,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return secureJson(
        res,
        error?.status || 500,
        secureRequest.aesKey,
        buildDriveErrorPayload(error),
        origin,
      )
    }
  }

  async function handleDriveList(req, res, origin, url) {
    const requestId = req.requestId

    try {
      const payload = await alistService.listDirectory(
        requestId,
        getQueryString(url, 'path', '/'),
        {
          page: getQueryNumber(url, 'page', 1),
          perPage: getQueryNumber(url, 'perPage', 200),
          refresh: getQueryBoolean(url, 'refresh', false),
        },
      )
      return json(res, 200, payload, origin)
    } catch (error) {
      log('ERROR', t('drive_list_failed'), {
        requestId,
        path: getQueryString(url, 'path', '/'),
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveItem(req, res, origin, url) {
    const requestId = req.requestId
    const path = getQueryString(url, 'path', '/')
    const intent = getQueryString(url, 'intent', 'view')
    const refresh = getQueryBoolean(url, 'refresh', false)

    try {
      const payload = await alistService.getResolvedItem(requestId, path, { intent, refresh })
      return json(res, 200, payload, origin)
    } catch (error) {
      log('ERROR', t('drive_item_failed'), {
        requestId,
        path,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveSearch(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const parent = String(payload.parent || '/')
      const keywords = String(payload.keywords || '')

      try {
        const data = await alistService.search(requestId, {
          parent,
          keywords,
          page: Number(payload.page || 1),
          perPage: Number(payload.perPage || 200),
        })
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_search_failed'), {
          requestId,
          parent,
          keywords,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveMkdir(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const path = String(payload.path || '')
      try {
        const data = await alistService.makeDirectory(requestId, path)
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_mkdir_failed'), {
          requestId,
          path,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveRename(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const path = String(payload.path || '')
      const newName = String(payload.name || '')
      try {
        const data = await alistService.rename(requestId, path, newName)
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_rename_failed'), {
          requestId,
          path,
          newName,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveRemove(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const dir = String(payload.dir || '/')
      const names = Array.isArray(payload.names) ? payload.names : []
      try {
        const data = await alistService.remove(requestId, dir, names)
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_remove_failed'), {
          requestId,
          dir,
          names,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveMove(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const srcDir = String(payload.srcDir || '/')
      const dstDir = String(payload.dstDir || '/')
      const names = Array.isArray(payload.names) ? payload.names : []
      try {
        const data = await alistService.move(requestId, srcDir, dstDir, names)
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_move_failed'), {
          requestId,
          srcDir,
          dstDir,
          names,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveCopy(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      const srcDir = String(payload.srcDir || '/')
      const dstDir = String(payload.dstDir || '/')
      const names = Array.isArray(payload.names) ? payload.names : []
      try {
        const data = await alistService.copy(requestId, srcDir, dstDir, names)
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', t('drive_copy_failed'), {
          requestId,
          srcDir,
          dstDir,
          names,
          error: error instanceof Error ? error.message : String(error),
          status: error?.status,
        })
        return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
      }
    })
  }

  async function handleDriveUpload(req, res, origin, url) {
    const requestId = req.requestId

    try {
      const data = await alistService.upload(requestId, req, {
        path: getQueryString(url, 'path', '/'),
        asTask: getQueryBoolean(url, 'asTask', false),
      })
      return json(res, 200, data, origin)
    } catch (error) {
      log('ERROR', t('drive_upload_failed'), {
        requestId,
        path: getQueryString(url, 'path', '/'),
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveRaw(req, res, origin, url) {
    const requestId = req.requestId
    const path = getQueryString(url, 'path', '/')

    try {
      const intent = getQueryString(url, 'intent', 'download')
      const item = await alistService.getResolvedItem(requestId, path, { intent })
      const rawUrl = item?.rawUrl || item?.resolvedUrl
      if (!rawUrl) {
        const error = new Error('This file did not return a raw download URL')
        error.status = 404
        throw error
      }

      if (intent === 'download') {
        res.writeHead(302, {
          Location: rawUrl,
          ...buildCorsHeaders(origin),
        })
        res.end()
        return
      }

      const upstream = await fetch(rawUrl, {
        headers: req.headers.range ? { Range: req.headers.range } : undefined,
        redirect: 'follow',
      })

      if (!upstream.ok && upstream.status !== 206) {
        throw new Error(`Upstream file request failed with status ${upstream.status}`)
      }

      const upstreamHeaders = upstream.headers
      const responseHeaders = {
        ...buildCorsHeaders(origin),
        'Content-Type': upstreamHeaders.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `${intent === 'view' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeContentDispositionFilename(item.name || 'download')}`,
      }

      const passthroughHeaders = [
        'accept-ranges',
        'cache-control',
        'content-length',
        'content-range',
        'etag',
        'last-modified',
      ]

      for (const headerName of passthroughHeaders) {
        const value = upstreamHeaders.get(headerName)
        if (value) {
          responseHeaders[headerName] = value
        }
      }

      res.writeHead(upstream.status, responseHeaders)

      if (!upstream.body) {
        res.end()
        return
      }

      await new Promise((resolve, reject) => {
        const stream = Readable.fromWeb(upstream.body)
        stream.on('error', reject)
        res.on('close', resolve)
        res.on('finish', resolve)
        stream.pipe(res)
      })
    } catch (error) {
      log('ERROR', t('drive_raw_failed'), {
        requestId,
        path: getQueryString(url, 'path', '/'),
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveCryptoPublicKey(_req, res, origin) {
    return json(res, 200, driveCrypto.getPublicConfig(), origin)
  }

  async function handleDriveSecure(req, res, origin) {
    const requestId = req.requestId

    return withSecureBody(req, res, origin, async (securePayload) => {
      const action = String(securePayload.action || '')
      const payload = securePayload.payload && typeof securePayload.payload === 'object'
        ? securePayload.payload
        : {}

      if (action === 'status') {
        return alistService.getStatus(requestId)
      }

      if (action === 'list') {
        return alistService.listDirectory(
          requestId,
          String(payload.path || '/'),
          {
            page: Number(payload.page || 1),
            perPage: Number(payload.perPage || 200),
            refresh: payload.refresh === true,
          },
        )
      }

      if (action === 'item') {
        return alistService.getResolvedItem(
          requestId,
          String(payload.path || '/'),
          { intent: String(payload.intent || 'view') },
        )
      }

      if (action === 'search') {
        return alistService.search(requestId, {
          parent: String(payload.parent || '/'),
          keywords: String(payload.keywords || ''),
          page: Number(payload.page || 1),
          perPage: Number(payload.perPage || 200),
        })
      }

      if (action === 'mkdir') {
        return alistService.makeDirectory(requestId, String(payload.path || ''))
      }

      if (action === 'rename') {
        return alistService.rename(
          requestId,
          String(payload.path || ''),
          String(payload.name || ''),
        )
      }

      if (action === 'remove') {
        return alistService.remove(
          requestId,
          String(payload.dir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
      }

      if (action === 'move') {
        return alistService.move(
          requestId,
          String(payload.srcDir || '/'),
          String(payload.dstDir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
      }

      if (action === 'copy') {
        return alistService.copy(
          requestId,
          String(payload.srcDir || '/'),
          String(payload.dstDir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
      }

      const error = new Error('Unknown secure drive action')
      error.status = 404
      throw error
    })
  }

  return {
    handleDriveCryptoPublicKey,
    handleDriveSecure,
    handleDriveStatus,
    handleDriveList,
    handleDriveItem,
    handleDriveSearch,
    handleDriveMkdir,
    handleDriveRename,
    handleDriveRemove,
    handleDriveMove,
    handleDriveCopy,
    handleDriveUpload,
    handleDriveRaw,
  }
}
