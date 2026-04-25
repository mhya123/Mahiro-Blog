import type { ArchivePreviewEntry } from './types'
import { formatPreviewBytes } from './file-types'

export function parseTarEntries(bytes: Uint8Array) {
    const entries: ArchivePreviewEntry[] = []
    let offset = 0

    while (offset + 512 <= bytes.length) {
        const header = bytes.subarray(offset, offset + 512)
        if (header.every((value) => value === 0)) {
            break
        }

        const readString = (start: number, end: number) =>
            new TextDecoder('utf-8')
                .decode(header.subarray(start, end))
                .replace(/\0.*$/, '')
                .trim()

        const name = readString(0, 100)
        const prefix = readString(345, 500)
        const sizeRaw = readString(124, 136).replace(/\0/g, '').trim()
        const typeFlag = readString(156, 157)
        const size = Number.parseInt(sizeRaw || '0', 8) || 0
        const path = prefix ? `${prefix}/${name}` : name

        if (path) {
            entries.push({
                path,
                size,
                sizeLabel: formatPreviewBytes(size),
                isDir: typeFlag === '5' || path.endsWith('/'),
            })
        }

        offset += 512 + Math.ceil(size / 512) * 512
    }

    return entries
}
