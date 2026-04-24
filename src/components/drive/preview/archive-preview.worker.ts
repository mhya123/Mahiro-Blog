/// <reference lib="webworker" />

import sevenZipWasmUrl from '7z-wasm/7zz.wasm?url'
import type { SevenZipModule as SevenZipRuntimeModule } from '7z-wasm'
import { ARCHIVE_PREVIEW_LIMIT_BYTES, formatPreviewBytes, getFileExtension } from './file-types'
import type { ArchivePreviewEntry } from './types'

type ArchivePreviewWorkerRequest = {
    id: string
    archiveName: string
    bytes: ArrayBuffer
}

type ArchivePreviewWorkerResponse = {
    id: string
    ok: boolean
    entries?: ArchivePreviewEntry[]
    error?: string
}

type SevenZipModule = SevenZipRuntimeModule & {
    callMain: (args?: string[]) => number | void
}

const ARCHIVE_LIKE_PATTERN = /\.(zip|tar|gz|tgz|rar|7z|bz2|xz|lz|lzma|cab|iso)$/i

function getArchiveIndent(level: number) {
    return '  '.repeat(Math.max(0, level))
}

function isArchiveLikePath(pathname: string) {
    return ARCHIVE_LIKE_PATTERN.test(String(pathname || ''))
}

function getSafeArchiveFilename(archiveName: string, level: number) {
    const extension = getFileExtension(archiveName)
    return `archive_${level}${extension || '.bin'}`
}

function ensureSevenZipDirectory(FS: any, path: string) {
    const parts = String(path || '').split('/').filter(Boolean)
    let current = ''

    for (const part of parts) {
        current += `/${part}`
        try {
            FS.mkdir(current)
        } catch {}
    }
}

function removeSevenZipTree(FS: any, path: string) {
    try {
        const stat = FS.stat(path)
        if (FS.isDir(stat.mode)) {
            for (const name of FS.readdir(path)) {
                if (name === '.' || name === '..') {
                    continue
                }
                removeSevenZipTree(FS, `${path}/${name}`)
            }
            FS.rmdir(path)
            return
        }

        FS.unlink(path)
    } catch {}
}

async function createSevenZipRuntime() {
    const sevenZipLogs: string[] = []
    const sevenZipErrors: string[] = []
    const module = await import('7z-wasm')
    const createSevenZip = module.default || module
    const wasmResponse = await fetch(sevenZipWasmUrl)

    if (!wasmResponse.ok) {
        throw new Error(`无法加载 7z wasm（HTTP ${wasmResponse.status}）`)
    }

    const wasmBinary = await wasmResponse.arrayBuffer()
    const sevenZip = (await createSevenZip({
        wasmBinary,
        locateFile(path?: string) {
            if (typeof path === 'string' && path.endsWith('.wasm')) {
                return sevenZipWasmUrl
            }
            return sevenZipWasmUrl
        },
        print(text?: string) {
            if (typeof text === 'string' && text.trim()) {
                sevenZipLogs.push(text.trim())
            }
        },
        printErr(text?: string) {
            if (typeof text === 'string' && text.trim()) {
                sevenZipErrors.push(text.trim())
            }
        },
    })) as unknown as SevenZipModule

    return {
        sevenZip,
        sevenZipLogs,
        sevenZipErrors,
    }
}

function buildSevenZipError(message: string, details: string[]) {
    const detail = details.filter(Boolean).slice(-6).join(' | ')
    return detail ? `${message}: ${detail}` : message
}

async function extractArchiveEntriesWithSevenZip(
    bytes: Uint8Array,
    archiveName: string,
    level = 0,
    parentPath = '',
): Promise<ArchivePreviewEntry[]> {
    const { sevenZip, sevenZipErrors, sevenZipLogs } = await createSevenZipRuntime()
    const { FS } = sevenZip
    const workspace = `/preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const archivePath = `${workspace}/${getSafeArchiveFilename(archiveName, level)}`
    const outputDir = `${workspace}/out`

    ensureSevenZipDirectory(FS, workspace)
    ensureSevenZipDirectory(FS, outputDir)
    FS.writeFile(archivePath, bytes)

    try {
        const exitCode = Number(sevenZip.callMain(['x', archivePath, `-o${outputDir}`, '-y', '-bb1']) ?? 0)
        if (exitCode !== 0) {
            throw new Error(buildSevenZipError(`7z 退出码 ${exitCode}`, [...sevenZipErrors, ...sevenZipLogs]))
        }

        const entries: ArchivePreviewEntry[] = []

        const walk = async (dirPath: string, relativePath = ''): Promise<void> => {
            for (const name of FS.readdir(dirPath)) {
                if (name === '.' || name === '..') {
                    continue
                }

                const fullPath = `${dirPath}/${name}`
                const nextRelativePath = relativePath ? `${relativePath}/${name}` : name
                const stat = FS.stat(fullPath)
                const isDir = FS.isDir(stat.mode)
                const size = Number(stat.size || 0)
                const displayPath = `${getArchiveIndent(level)}${parentPath}${nextRelativePath}`

                entries.push({
                    path: displayPath,
                    size,
                    sizeLabel: formatPreviewBytes(size),
                    isDir,
                })

                if (isDir) {
                    await walk(fullPath, nextRelativePath)
                    continue
                }

                if (level < 4 && size <= ARCHIVE_PREVIEW_LIMIT_BYTES && isArchiveLikePath(name)) {
                    try {
                        const nestedBytes = FS.readFile(fullPath, { encoding: 'binary' }) as Uint8Array
                        const nestedEntries = await extractArchiveEntriesWithSevenZip(
                            nestedBytes,
                            name,
                            level + 1,
                            `${displayPath} -> `,
                        )
                        entries.push(...nestedEntries)
                    } catch {}
                }
            }
        }

        await walk(outputDir)
        return entries
    } finally {
        removeSevenZipTree(FS, workspace)
    }
}

self.onmessage = async (event: MessageEvent<ArchivePreviewWorkerRequest>) => {
    const respond = (payload: ArchivePreviewWorkerResponse) => {
        self.postMessage(payload)
    }

    try {
        const entries = await extractArchiveEntriesWithSevenZip(
            new Uint8Array(event.data.bytes),
            event.data.archiveName,
        )

        respond({
            id: event.data.id,
            ok: true,
            entries,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Archive preview worker failed'
        respond({
            id: event.data.id,
            ok: false,
            error: message,
        })
    }
}

export {}
