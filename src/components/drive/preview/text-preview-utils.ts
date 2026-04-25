type SupportedTextEncoding = 'utf-8' | 'utf-16le' | 'gb18030' | 'windows-1252'

export function parseCsv(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split(',').map((cell) => cell.trim()))
}

export function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;')
}

export function paragraphsToHtml(text: string) {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
        .join('')
}

export function buildSpreadsheetHtml(rows: unknown[][]) {
    if (!rows.length) {
        return '<div class="text-sm text-base-content/60">当前工作表没有可显示的数据。</div>'
    }

    const normalizedRows = rows.map((row) => Array.isArray(row) ? row : [])
    const maxColumns = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0)
    if (maxColumns === 0) {
        return '<div class="text-sm text-base-content/60">当前工作表没有可显示的数据。</div>'
    }

    const tableRows = normalizedRows
        .map((row, rowIndex) => {
            const tag = rowIndex === 0 ? 'th' : 'td'
            const cells = Array.from({ length: maxColumns }, (_, columnIndex) => {
                const cell = row[columnIndex]
                const value = cell == null ? '' : String(cell)
                return `<${tag}>${escapeHtml(value)}</${tag}>`
            }).join('')

            return `<tr>${cells}</tr>`
        })
        .join('')

    return `<table><tbody>${tableRows}</tbody></table>`
}

export function stripRtfToText(input: string) {
    return input
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\'[0-9a-fA-F]{2}/g, '')
        .replace(/\\[a-z]+-?\d* ?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export function cleanupDecodedText(text: string) {
    return text
        .replace(/\u0000/g, '')
        .replace(/[^\S\r\n]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function scoreDecodedText(text: string) {
    if (!text) return 0
    const printable = (text.match(/[\p{L}\p{N}\p{P}\p{Zs}\r\n]/gu) || []).length
    return printable / text.length
}

export function bestEffortDecode(buffer: ArrayBuffer) {
    const encodings: SupportedTextEncoding[] = ['utf-8', 'utf-16le', 'gb18030', 'windows-1252']
    let best = ''
    let bestScore = 0

    for (const encoding of encodings) {
        try {
            const text = cleanupDecodedText(new TextDecoder(encoding).decode(buffer))
            const score = scoreDecodedText(text)
            if (score > bestScore) {
                best = text
                bestScore = score
            }
        } catch {
            continue
        }
    }

    return best
}

export function collectXmlText(value: unknown, result: string[] = []) {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) {
            result.push(trimmed)
        }
        return result
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectXmlText(item, result)
        }
        return result
    }

    if (value && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
            if (key === '#text') {
                collectXmlText(nested, result)
                continue
            }

            if (key.startsWith('@_')) {
                continue
            }

            collectXmlText(nested, result)
        }
    }

    return result
}
