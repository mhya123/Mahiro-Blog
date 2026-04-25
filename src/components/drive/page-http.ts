import { SITE_API_BASE_URL } from '@/consts'
import { decryptDrivePayload, encryptDrivePayload } from './drive-crypto'

type DriveSecureAction =
    | 'status'
    | 'list'
    | 'item'
    | 'search'
    | 'mkdir'
    | 'rename'
    | 'remove'
    | 'move'
    | 'copy'

export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : `Request failed with status ${response.status}`
        const error = new Error(message) as Error & { status?: number; details?: unknown }
        error.status = response.status
        error.details = data?.details
        throw error
    }

    return data as T
}

export async function requestDriveJson<T>(action: DriveSecureAction, payload: Record<string, unknown> = {}): Promise<T> {
    const encrypted = await encryptDrivePayload({ action, payload })
    const response = await fetch(`${SITE_API_BASE_URL}/api/drive/secure`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(encrypted.envelope),
    })
    const data = await response.json().catch(() => ({}))
    const decrypted = await decryptDrivePayload<T | { error?: string; details?: unknown }>(encrypted.aesKey, data)

    if (!response.ok) {
        const errorPayload = decrypted as { error?: string; details?: unknown }
        const message = typeof errorPayload?.error === 'string' ? errorPayload.error : `Request failed with status ${response.status}`
        const error = new Error(message) as Error & { status?: number; details?: unknown }
        error.status = response.status
        error.details = errorPayload?.details
        throw error
    }

    return decrypted as T
}

export function describeDriveError(error: unknown, fallback: string) {
    if (error instanceof Error) {
        if ('status' in error && (error as Error & { status?: number }).status === 403) {
            return '当前权限不允许执行这个网盘操作。'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 404) {
            return '目标文件或接口不存在，可能是后端还没部署最新网盘接口，或该文件已经失效。'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 401) {
            return '网盘鉴权失败，请检查后端里的 AList 账号、密码或 Token。'
        }

        return error.message || fallback
    }

    return fallback
}
