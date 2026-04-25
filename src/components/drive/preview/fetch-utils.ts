import type { DriveItemPayload } from '../types'

const PREVIEW_FETCH_TIMEOUT_MS = 30_000

export async function fetchPreviewResponse(previewUrl: string) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), PREVIEW_FETCH_TIMEOUT_MS)

    const response = await fetch(previewUrl, {
        cache: 'no-store',
        signal: controller.signal,
    }).finally(() => {
        window.clearTimeout(timeoutId)
    })

    if (!response.ok) {
        throw new Error(`Preview request failed: ${response.status}`)
    }

    return response
}

export async function fetchPreviewResponseWithFallback(urls: string[]) {
    let lastError: unknown = null

    for (const candidate of urls.filter(Boolean)) {
        try {
            return await fetchPreviewResponse(candidate)
        } catch (error) {
            lastError = error
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Preview request failed')
}

export async function fetchPreviewBlobWithFallback(urls: string[]) {
    const response = await fetchPreviewResponseWithFallback(urls)
    return response.blob()
}

export async function fetchPreviewTextWithFallback(urls: string[]) {
    const response = await fetchPreviewResponseWithFallback(urls)
    return response.text()
}

export function getPreviewSourceUrls(item: DriveItemPayload, previewUrl: string) {
    return [previewUrl, item.rawUrl, item.resolvedUrl].filter(Boolean)
}

export function getRemoteOfficeEmbedSource(item: DriveItemPayload, previewUrl: string) {
    const candidates = [item.resolvedUrl, item.rawUrl, previewUrl].filter(Boolean)

    for (const candidate of candidates) {
        try {
            const url = new URL(candidate)
            if (url.protocol === 'https:') {
                return url.toString()
            }
        } catch {
            continue
        }
    }

    return ''
}
