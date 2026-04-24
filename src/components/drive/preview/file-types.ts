import type { DriveItemPayload } from '../types'
import type { DrivePreviewKind, OfficePreviewFormat } from './types'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.flv', '.mkv', '.mov', '.avi', '.wmv', '.m4v', '.rmvb', '.rm', '.mpeg', '.mpg', '.3gp'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.aac', '.ogg', '.wma', '.flac', '.alac', '.m4a', '.ape', '.wav', '.aiff', '.midi', '.mid', '.amr'])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])
const HTML_EXTENSIONS = new Set(['.html', '.htm'])
const JSON_EXTENSIONS = new Set(['.json'])
const CSV_EXTENSIONS = new Set(['.csv'])
const XML_EXTENSIONS = new Set(['.xml'])
const YAML_EXTENSIONS = new Set(['.yaml', '.yml'])
const OFFICE_EXTENSIONS = new Map<string, OfficePreviewFormat>([
    ['.doc', 'doc'],
    ['.docx', 'docx'],
    ['.odt', 'odt'],
    ['.pages', 'pages'],
    ['.pptx', 'pptx'],
    ['.rtf', 'rtf'],
    ['.xlsx', 'xlsx'],
])
const PDF_EXTENSIONS = new Set(['.pdf'])
const ARCHIVE_EXTENSIONS = new Set([
    '.zip',
    '.tar',
    '.gz',
    '.tgz',
    '.rar',
    '.7z',
    '.bz2',
    '.xz',
    '.lz',
    '.lzma',
    '.cab',
    '.iso',
])
const TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.mdx',
    '.rtf',
    '.doc',
    '.docx',
    '.pdf',
    '.odt',
    '.pages',
    '.json',
    '.csv',
    '.xml',
    '.yaml',
    '.yml',
    '.ini',
    '.conf',
    '.cfg',
    '.log',
    '.html',
    '.htm',
    '.css',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.astro',
    '.py',
    '.java',
    '.php',
    '.sh',
    '.bat',
    '.sql',
])

export const ARCHIVE_PREVIEW_LIMIT_BYTES = 200 * 1024 * 1024

export function getFileExtension(filename: string) {
    const match = String(filename || '').toLowerCase().match(/\.([^.]+)$/)
    return match ? `.${match[1]}` : ''
}

export function formatPreviewBytes(value: number) {
    const size = Number(value || 0)
    if (!Number.isFinite(size) || size <= 0) {
        return '0 B'
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let index = 0
    let current = size

    while (current >= 1024 && index < units.length - 1) {
        current /= 1024
        index += 1
    }

    const precision = current >= 100 || index === 0 ? 0 : current >= 10 ? 1 : 2
    return `${current.toFixed(precision)} ${units[index]}`
}

export function isTextLikeExtension(extension: string) {
    return TEXT_EXTENSIONS.has(extension)
}

export function isMarkdownExtension(extension: string) {
    return MARKDOWN_EXTENSIONS.has(extension)
}

export function isCsvExtension(extension: string) {
    return CSV_EXTENSIONS.has(extension)
}

export function isHtmlExtension(extension: string) {
    return HTML_EXTENSIONS.has(extension)
}

export function isJsonExtension(extension: string) {
    return JSON_EXTENSIONS.has(extension)
}

export function isXmlExtension(extension: string) {
    return XML_EXTENSIONS.has(extension)
}

export function isYamlExtension(extension: string) {
    return YAML_EXTENSIONS.has(extension)
}

export function getOfficePreviewFormat(filename: string): OfficePreviewFormat | null {
    return OFFICE_EXTENSIONS.get(getFileExtension(filename)) || null
}

export function isArchiveExtension(extension: string) {
    return ARCHIVE_EXTENSIONS.has(extension)
}

export function canPreviewArchive(filename: string, size: number) {
    return isArchiveExtension(getFileExtension(filename)) && size <= ARCHIVE_PREVIEW_LIMIT_BYTES
}

export function getPreviewKind(item: DriveItemPayload): DrivePreviewKind | null {
    const extension = getFileExtension(item.name)

    if (IMAGE_EXTENSIONS.has(extension) || item.type === 'image') return 'image'
    if (VIDEO_EXTENSIONS.has(extension) || item.type === 'video') return 'video'
    if (AUDIO_EXTENSIONS.has(extension) || item.type === 'audio') return 'audio'
    if (PDF_EXTENSIONS.has(extension) || item.type === 'pdf') return 'pdf'
    if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
    if (HTML_EXTENSIONS.has(extension)) return 'html'
    if (OFFICE_EXTENSIONS.has(extension)) return 'office'
    if (canPreviewArchive(item.name, item.size)) return 'archive'
    if (CSV_EXTENSIONS.has(extension)) return 'text'
    if (JSON_EXTENSIONS.has(extension)) return 'text'
    if (XML_EXTENSIONS.has(extension)) return 'text'
    if (YAML_EXTENSIONS.has(extension)) return 'text'
    if (isTextLikeExtension(extension) || item.type === 'text') return 'text'
    if (isArchiveExtension(extension)) return 'unsupported'
    return null
}
