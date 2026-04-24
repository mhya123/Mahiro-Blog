import ArchivePreviewWorker from './archive-preview.worker?worker'
import type { ArchivePreviewEntry } from './types'

type ArchivePreviewWorkerSuccess = {
    id: string
    ok: true
    entries: ArchivePreviewEntry[]
}

type ArchivePreviewWorkerFailure = {
    id: string
    ok: false
    error?: string
}

type ArchivePreviewWorkerResponse = ArchivePreviewWorkerSuccess | ArchivePreviewWorkerFailure

export async function extractArchiveEntriesInWorker(bytes: Uint8Array, archiveName: string): Promise<ArchivePreviewEntry[]> {
    if (typeof Worker === 'undefined') {
        throw new Error('当前浏览器不支持压缩包预览 Worker。')
    }

    const worker = new ArchivePreviewWorker()
    const id = `archive-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    return await new Promise<ArchivePreviewEntry[]>((resolve, reject) => {
        const cleanup = () => {
            worker.removeEventListener('message', handleMessage)
            worker.removeEventListener('error', handleError)
            worker.terminate()
        }

        const handleMessage = (event: MessageEvent<ArchivePreviewWorkerResponse>) => {
            if (event.data?.id !== id) {
                return
            }

            cleanup()

            if (event.data.ok) {
                resolve(event.data.entries || [])
                return
            }

            reject(new Error(event.data.error || '压缩包预览失败'))
        }

        const handleError = (event: ErrorEvent) => {
            cleanup()
            reject(new Error(event.message || '压缩包预览 Worker 初始化失败'))
        }

        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', handleError)
        worker.postMessage({
            id,
            archiveName,
            bytes: bytes.buffer.slice(0),
        })
    })
}
