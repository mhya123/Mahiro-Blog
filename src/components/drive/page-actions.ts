import { SITE_API_BASE_URL } from '@/consts'

export function triggerExternalUrl(url: string, options: { downloadName?: string; newTab?: boolean } = {}) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.rel = 'noopener noreferrer'
    if (options.newTab) {
        anchor.target = '_blank'
    }
    if (options.downloadName) {
        anchor.download = options.downloadName
    }
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
}

export async function copyTextToClipboard(text: string) {
    const value = String(text || '').trim()
    if (!value) {
        throw new Error('empty clipboard text')
    }

    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, value.length)

    try {
        // 降级方案：非安全上下文 (HTTP) 无法使用 Clipboard API，只能依赖已废弃的 execCommand
        // @ts-ignore — execCommand 已被 W3C 标记为 deprecated，但在非 HTTPS 场景下无替代方案
        document.execCommand('copy')
    } catch {
        textarea.remove()
        throw new Error('copy command failed')
    }
    textarea.remove()
}

export function buildPotPlayerUrl(url: string) {
    return `potplayer://${String(url || '').trim()}`
}

export function buildDriveFileUrl(path: string, intent: 'view' | 'download') {
    return `${SITE_API_BASE_URL}/api/drive/raw?path=${encodeURIComponent(path)}&intent=${intent}`
}
