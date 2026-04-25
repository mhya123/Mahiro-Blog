import { Readable } from 'node:stream'

function buildDriveErrorPayload(error, fallbackMessage = 'Drive request failed') {
  return {
    error: error instanceof Error ? error.message : fallbackMessage,
    details: error?.payload || null,
  }
}

export function createDriveHandlers({
  alistService,
  log,
  json,
  readJsonBody,
  buildCorsHeaders,
  getQueryString,
  getQueryBoolean,
  getQueryNumber,
  encodeContentDispositionFilename,
}) {
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
      log('ERROR', 'Drive status failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
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
      log('ERROR', 'Drive list failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveItem(req, res, origin, url) {
    const requestId = req.requestId

    try {
      const path = getQueryString(url, 'path', '/')
      const intent = getQueryString(url, 'intent', 'view')
      const payload = await alistService.getResolvedItem(requestId, path, { intent })
      return json(res, 200, payload, origin)
    } catch (error) {
      log('ERROR', 'Drive item failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveSearch(req, res, origin) {
    const requestId = req.requestId

    return withJsonBody(req, res, origin, async (payload) => {
      try {
        const data = await alistService.search(requestId, {
          parent: String(payload.parent || '/'),
          keywords: String(payload.keywords || ''),
          page: Number(payload.page || 1),
          perPage: Number(payload.perPage || 200),
        })
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive search failed', {
          requestId,
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
      try {
        const data = await alistService.makeDirectory(requestId, String(payload.path || ''))
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive mkdir failed', {
          requestId,
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
      try {
        const data = await alistService.rename(
          requestId,
          String(payload.path || ''),
          String(payload.name || ''),
        )
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive rename failed', {
          requestId,
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
      try {
        const data = await alistService.remove(
          requestId,
          String(payload.dir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive remove failed', {
          requestId,
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
      try {
        const data = await alistService.move(
          requestId,
          String(payload.srcDir || '/'),
          String(payload.dstDir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive move failed', {
          requestId,
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
      try {
        const data = await alistService.copy(
          requestId,
          String(payload.srcDir || '/'),
          String(payload.dstDir || '/'),
          Array.isArray(payload.names) ? payload.names : [],
        )
        return json(res, 200, data, origin)
      } catch (error) {
        log('ERROR', 'Drive copy failed', {
          requestId,
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
      log('ERROR', 'Drive upload failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  async function handleDriveRaw(req, res, origin, url) {
    const requestId = req.requestId

    try {
      const path = getQueryString(url, 'path', '/')
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
      log('ERROR', 'Drive raw redirect failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
      })
      return json(res, error?.status || 500, buildDriveErrorPayload(error), origin)
    }
  }

  return {
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
