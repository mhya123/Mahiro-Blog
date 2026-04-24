import { marked } from 'marked'
import type { DriveEntry, DriveItemPayload } from '../types'
import {
    ARCHIVE_PREVIEW_LIMIT_BYTES,
    canPreviewArchive,
    formatPreviewBytes,
    getFileExtension,
    getOfficePreviewFormat,
    getPreviewKind,
    isCsvExtension,
    isHtmlExtension,
    isJsonExtension,
    isMarkdownExtension,
} from './file-types'
import { extractArchiveEntriesInWorker } from './archive-preview-client'
import type {
    ArchivePreviewEntry,
    DrivePreviewState,
    OfficePreviewData,
} from './types'

type SupportedTextEncoding = 'utf-8' | 'utf-16le' | 'gb18030' | 'windows-1252'

async function fetchPreviewResponse(previewUrl: string) {
    const response = await fetch(previewUrl)
    if (!response.ok) {
        throw new Error(`Preview request failed: ${response.status}`)
    }
    return response
}

async function fetchPreviewResponseWithFallback(urls: string[]) {
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

async function fetchPreviewBlobWithFallback(urls: string[]) {
    const response = await fetchPreviewResponseWithFallback(urls)
    return response.blob()
}

async function fetchPreviewTextWithFallback(urls: string[]) {
    const response = await fetchPreviewResponseWithFallback(urls)
    return response.text()
}

function getPreviewSourceUrls(item: DriveItemPayload, previewUrl: string) {
    return [item.resolvedUrl, item.rawUrl, previewUrl].filter(Boolean)
}

function parseCsv(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split(',').map((cell) => cell.trim()))
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;')
}

function paragraphsToHtml(text: string) {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
        .join('')
}

function stripRtfToText(input: string) {
    return input
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\'[0-9a-fA-F]{2}/g, '')
        .replace(/\\[a-z]+-?\d* ?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function cleanupDecodedText(text: string) {
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

function bestEffortDecode(buffer: ArrayBuffer) {
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

function collectXmlText(value: unknown, result: string[] = []) {
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

function sortSlideFiles(files: string[]) {
    return [...files].sort((left, right) => {
        const leftMatch = left.match(/slide(\d+)\.xml$/)
        const rightMatch = right.match(/slide(\d+)\.xml$/)
        return Number(leftMatch?.[1] || 0) - Number(rightMatch?.[1] || 0)
    })
}

function parseTarEntries(bytes: Uint8Array) {
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

function buildUnsupportedPreview(entry: DriveEntry, item: DriveItemPayload, message: string): DrivePreviewState {
    return {
        entry,
        item,
        kind: 'unsupported',
        url: '',
        message,
    }
}

async function loadBinaryPreview(
    entry: DriveEntry,
    item: DriveItemPayload,
    previewUrl: string,
    kind: 'image' | 'video' | 'audio' | 'pdf',
): Promise<DrivePreviewState> {
    return {
        entry,
        item,
        kind,
        url: item.resolvedUrl || item.rawUrl || previewUrl,
    }
}

async function loadTextPreview(entry: DriveEntry, item: DriveItemPayload, previewUrl: string): Promise<DrivePreviewState> {
    let textContent = await fetchPreviewTextWithFallback(getPreviewSourceUrls(item, previewUrl))
    const extension = getFileExtension(item.name)
    let htmlContent = ''
    let csvRows: string[][] | undefined

    if (extension === '.rtf') {
        textContent = stripRtfToText(textContent)
    }

    if (isJsonExtension(extension)) {
        try {
            textContent = JSON.stringify(JSON.parse(textContent), null, 2)
        } catch {
            textContent = textContent
        }
    }

    if (isMarkdownExtension(extension)) {
        htmlContent = await marked.parse(textContent)
        return {
            entry,
            item,
            kind: 'markdown',
            url: previewUrl,
            textContent,
            htmlContent,
        }
    }

    if (isHtmlExtension(extension)) {
        htmlContent = textContent
        return {
            entry,
            item,
            kind: 'html',
            url: previewUrl,
            textContent,
            htmlContent,
        }
    }

    if (isCsvExtension(extension)) {
        csvRows = parseCsv(textContent)
    }

    return {
        entry,
        item,
        kind: 'text',
        url: previewUrl,
        textContent,
        csvRows,
    }
}

async function loadDocxPreview(arrayBuffer: ArrayBuffer): Promise<OfficePreviewData> {
    const mammothModule = await import('mammoth/mammoth.browser')
    const mammoth = (mammothModule.default || mammothModule) as {
        convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
        extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }

    const [htmlResult, textResult] = await Promise.all([
        mammoth.convertToHtml({ arrayBuffer }),
        mammoth.extractRawText({ arrayBuffer }),
    ])

    return {
        format: 'docx',
        html: htmlResult.value,
        text: textResult.value,
    }
}

async function loadXlsxPreview(arrayBuffer: ArrayBuffer): Promise<OfficePreviewData> {
    const xlsxModule = await import('xlsx')
    const XLSX = xlsxModule.default || xlsxModule
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheets = workbook.SheetNames.map((name: string) => ({
        name,
        html: XLSX.utils.sheet_to_html(workbook.Sheets[name]),
    }))

    return {
        format: 'xlsx',
        sheets,
    }
}

async function loadPptxPreview(arrayBuffer: ArrayBuffer): Promise<OfficePreviewData> {
    const [zipModule, xmlModule] = await Promise.all([
        import('jszip'),
        import('fast-xml-parser'),
    ])
    const JSZip = zipModule.default || zipModule
    const { XMLParser } = xmlModule
    const zip = await JSZip.loadAsync(arrayBuffer)
    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
    })

    const slideFiles = sortSlideFiles(
        Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)),
    )

    const slides = await Promise.all(
        slideFiles.map(async (name, index) => {
            const xml = await zip.files[name].async('text')
            const parsed = parser.parse(xml)
            const texts = collectXmlText(parsed).filter(Boolean)

            return {
                title: texts[0] || `Slide ${index + 1}`,
                body: texts.slice(1),
            }
        }),
    )

    return {
        format: 'pptx',
        slides,
    }
}

async function loadOdtPreview(arrayBuffer: ArrayBuffer): Promise<OfficePreviewData> {
    const [zipModule, xmlModule] = await Promise.all([
        import('jszip'),
        import('fast-xml-parser'),
    ])
    const JSZip = zipModule.default || zipModule
    const { XMLParser } = xmlModule
    const zip = await JSZip.loadAsync(arrayBuffer)
    const content = zip.files['content.xml']

    if (!content) {
        return {
            format: 'odt',
            text: '无法读取 ODT 内容。',
        }
    }

    const xml = await content.async('text')
    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
    })
    const parsed = parser.parse(xml)
    const text = collectXmlText(parsed).join('\n')

    return {
        format: 'odt',
        text,
        html: paragraphsToHtml(text),
    }
}

async function loadPagesPreview(arrayBuffer: ArrayBuffer, entry: DriveEntry, item: DriveItemPayload): Promise<DrivePreviewState> {
    const zipModule = await import('jszip')
    const JSZip = zipModule.default || zipModule
    const zip = await JSZip.loadAsync(arrayBuffer)

    const previewPdf = zip.files['QuickLook/Preview.pdf'] || zip.files['preview.pdf']
    if (previewPdf) {
        const blob = await previewPdf.async('blob')
        const objectUrl = URL.createObjectURL(blob)

        return {
            entry,
            item,
            kind: 'pdf',
            url: objectUrl,
            revokeUrls: [objectUrl],
            officeData: {
                format: 'pages',
            },
        }
    }

    const indexXml = zip.files['index.xml']
    if (indexXml) {
        const text = cleanupDecodedText(await indexXml.async('text'))
        return {
            entry,
            item,
            kind: 'office',
            url: '',
            officeData: {
                format: 'pages',
                text,
                html: paragraphsToHtml(text),
            },
        }
    }

    return buildUnsupportedPreview(entry, item, '当前 Pages 文档不包含可读取的预览内容，请先下载后查看。')
}

async function loadDocPreview(arrayBuffer: ArrayBuffer): Promise<OfficePreviewData> {
    const text = bestEffortDecode(arrayBuffer) || '当前 .doc 文档无法稳定解析为富文本，以下为可提取的原始文本。'
    return {
        format: 'doc',
        text,
        html: `<pre>${escapeHtml(text)}</pre>`,
    }
}

async function loadRtfPreview(urls: string[]): Promise<OfficePreviewData> {
    const raw = await fetchPreviewTextWithFallback(urls)
    const text = stripRtfToText(raw)
    return {
        format: 'rtf',
        text,
        html: paragraphsToHtml(text),
    }
}

async function loadOfficePreview(entry: DriveEntry, item: DriveItemPayload, previewUrl: string): Promise<DrivePreviewState> {
    const format = getOfficePreviewFormat(item.name)
    if (!format) {
        return buildUnsupportedPreview(entry, item, '当前 Office 文档类型暂不支持站内预览，请使用下载。')
    }

    if (format === 'rtf') {
        const officeData = await loadRtfPreview(getPreviewSourceUrls(item, previewUrl))
        return {
            entry,
            item,
            kind: 'office',
            url: '',
            officeData,
        }
    }

    const blob = await fetchPreviewBlobWithFallback(getPreviewSourceUrls(item, previewUrl))
    const arrayBuffer = await blob.arrayBuffer()

    if (format === 'pages') {
        return loadPagesPreview(arrayBuffer, entry, item)
    }

    let officeData: OfficePreviewData
    switch (format) {
        case 'doc':
            officeData = await loadDocPreview(arrayBuffer)
            break
        case 'docx':
            officeData = await loadDocxPreview(arrayBuffer)
            break
        case 'odt':
            officeData = await loadOdtPreview(arrayBuffer)
            break
        case 'pptx':
            officeData = await loadPptxPreview(arrayBuffer)
            break
        case 'xlsx':
            officeData = await loadXlsxPreview(arrayBuffer)
            break
        default:
            officeData = {
                format,
                text: '当前文档暂不支持站内预览。',
            }
            break
    }

    return {
        entry,
        item,
        kind: 'office',
        url: '',
        officeData,
    }
}

async function loadArchivePreview(entry: DriveEntry, item: DriveItemPayload, previewUrl: string): Promise<DrivePreviewState> {
    if (!canPreviewArchive(item.name, item.size)) {
        return buildUnsupportedPreview(
            entry,
            item,
            `压缩包预览仅支持不超过 ${formatPreviewBytes(ARCHIVE_PREVIEW_LIMIT_BYTES)} 的文件。`,
        )
    }

    const extension = getFileExtension(item.name)
    const blob = await fetchPreviewBlobWithFallback(getPreviewSourceUrls(item, previewUrl))
    const arrayBuffer = await blob.arrayBuffer()
    let archiveEntries: ArchivePreviewEntry[] = []

    try {
        archiveEntries = await extractArchiveEntriesInWorker(new Uint8Array(arrayBuffer), item.name)
    } catch (error) {
        console.error('[drive] archive preview worker failed', {
            file: item.name,
            extension,
            error,
        })

        if (extension === '.zip') {
            const zipModule = await import('jszip')
            const JSZip = zipModule.default || zipModule
            const zip = await JSZip.loadAsync(arrayBuffer)
            archiveEntries = Object.values(zip.files).map((file) => {
                const fileData = file as unknown as { _data?: { uncompressedSize?: number } }
                const size = Number(fileData._data?.uncompressedSize || 0)

                return {
                    path: file.name,
                    size,
                    sizeLabel: formatPreviewBytes(size),
                    isDir: file.dir,
                }
            })
        } else if (extension === '.tar') {
            archiveEntries = parseTarEntries(new Uint8Array(arrayBuffer))
        } else if (extension === '.gz' || extension === '.tgz') {
            const fflateModule = await import('fflate')
            const payload = fflateModule.gunzipSync(new Uint8Array(arrayBuffer))
            if (extension === '.tgz' || item.name.endsWith('.tar.gz')) {
                archiveEntries = parseTarEntries(payload)
            } else {
                archiveEntries = [
                    {
                        path: item.name.replace(/\.gz$/i, ''),
                        size: payload.byteLength,
                        sizeLabel: formatPreviewBytes(payload.byteLength),
                        isDir: false,
                    },
                ]
            }
        } else {
            return buildUnsupportedPreview(entry, item, '当前压缩包暂时无法解析，请使用下载。')
        }
    }

    return {
        entry,
        item,
        kind: 'archive',
        url: '',
        archiveEntries,
        archiveSummary: `共 ${archiveEntries.length} 个条目，已尝试递归展开嵌套压缩包`,
    }
}

export async function loadDrivePreview(entry: DriveEntry, item: DriveItemPayload, previewUrl: string): Promise<DrivePreviewState> {
    const kind = getPreviewKind(item)

    if (!kind) {
        return buildUnsupportedPreview(entry, item, '该文件类型暂不支持站内预览，请使用下载。')
    }

    if (kind === 'unsupported') {
        if (getFileExtension(item.name) && item.size > ARCHIVE_PREVIEW_LIMIT_BYTES) {
            return buildUnsupportedPreview(
                entry,
                item,
                `压缩包预览仅支持不超过 ${formatPreviewBytes(ARCHIVE_PREVIEW_LIMIT_BYTES)} 的文件。`,
            )
        }

        return buildUnsupportedPreview(entry, item, '该文件类型暂不支持站内预览，请使用下载。')
    }

    switch (kind) {
        case 'image':
        case 'video':
        case 'audio':
        case 'pdf':
            return loadBinaryPreview(entry, item, previewUrl, kind)
        case 'markdown':
        case 'html':
        case 'text':
            return loadTextPreview(entry, item, previewUrl)
        case 'office':
            return loadOfficePreview(entry, item, previewUrl)
        case 'archive':
            return loadArchivePreview(entry, item, previewUrl)
        default:
            return buildUnsupportedPreview(entry, item, '该文件类型暂不支持站内预览，请使用下载。')
    }
}
