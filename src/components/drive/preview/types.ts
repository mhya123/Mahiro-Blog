import type { DriveEntry, DriveItemPayload } from '../types'

export type DrivePreviewKind
    = 'image'
    | 'video'
    | 'audio'
    | 'pdf'
    | 'text'
    | 'markdown'
    | 'json'
    | 'csv'
    | 'html'
    | 'office'
    | 'archive'
    | 'unsupported'

export type MarkdownPreviewMode = 'markdown' | 'markdown-wrap'
export type HtmlPreviewMode = 'preview' | 'editor'
export type CsvPreviewMode = 'table' | 'editor'
export type VideoPreviewMode = 'video' | 'video360'

export type OfficePreviewFormat = 'doc' | 'docx' | 'odt' | 'pages' | 'pptx' | 'rtf' | 'xlsx'

export type SpreadsheetSheetPreview = {
    name: string
    html: string
}

export type SlidePreview = {
    title: string
    body: string[]
}

export type OfficePreviewProviderId = 'microsoft' | 'google' | 'zoho'

export type OfficePreviewProvider = {
    id: OfficePreviewProviderId
    label: string
    mode: 'embed' | 'external'
    url: string
}

export type ArchivePreviewEntry = {
    path: string
    size: number
    sizeLabel: string
    isDir: boolean
}

export type OfficePreviewData = {
    format: OfficePreviewFormat
    onlinePreviews?: OfficePreviewProvider[]
    html?: string
    text?: string
    sheets?: SpreadsheetSheetPreview[]
    slides?: SlidePreview[]
}

export type DrivePreviewState = {
    entry: DriveEntry
    item: DriveItemPayload
    kind: DrivePreviewKind
    url: string
    revokeUrl?: string
    revokeUrls?: string[]
    textContent?: string
    htmlContent?: string
    csvRows?: string[][]
    archiveEntries?: ArchivePreviewEntry[]
    archiveSummary?: string
    officeData?: OfficePreviewData
    message?: string
}
