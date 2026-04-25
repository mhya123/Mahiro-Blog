'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CsvPreviewMode, DrivePreviewState, HtmlPreviewMode, MarkdownPreviewMode } from './types'
import { getFileExtension, isCsvExtension, isHtmlExtension, isMarkdownExtension } from './file-types'

type TextPreviewPanelProps = {
    previewState: DrivePreviewState
}

function getRawPreviewUrl(previewState: DrivePreviewState) {
    return previewState.item.resolvedUrl || previewState.item.rawUrl || ''
}

function getGooglePreviewUrl(sourceUrl: string) {
    if (!sourceUrl) {
        return ''
    }
    return `https://docs.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(sourceUrl)}`
}

function getZohoPreviewUrl(sourceUrl: string) {
    if (!sourceUrl) {
        return ''
    }
    return `https://viewer.zoho.com/api/urlview.do?url=${encodeURIComponent(sourceUrl)}`
}

function EditorView({ content, wrap }: { content: string; wrap: boolean }) {
    return (
        <div className="h-full overflow-auto rounded-2xl border border-base-300/70 bg-base-100 shadow-inner">
            <div className="border-b border-base-300/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">
                Text Editor
            </div>
            <pre
                className={`min-h-full p-5 font-mono text-sm leading-7 text-base-content ${
                    wrap ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
                }`}
            >
                {content || '暂无可显示文本内容。'}
            </pre>
        </div>
    )
}

function BrowserRawPreview({ title, src }: { title: string; src: string }) {
    return (
        <iframe
            src={src}
            title={title}
            className="h-full w-full rounded-2xl border border-base-300/70 bg-base-100"
        />
    )
}

export function TextPreviewPanel({ previewState }: TextPreviewPanelProps) {
    const extension = getFileExtension(previewState.item.name)
    const isMarkdown = isMarkdownExtension(extension) || previewState.kind === 'markdown'
    const isHtml = isHtmlExtension(extension) || previewState.kind === 'html'
    const isCsv = isCsvExtension(extension) && Array.isArray(previewState.csvRows)
    const rawPreviewUrl = getRawPreviewUrl(previewState)

    const externalPreviewLinks = useMemo(() => {
        if (!rawPreviewUrl) {
            return []
        }

        return [{ label: 'Google Preview', url: getGooglePreviewUrl(rawPreviewUrl) }].filter((item) => Boolean(item.url))

        return [
            { label: 'Google 外部', url: getGooglePreviewUrl(rawPreviewUrl) },
            { label: 'Zoho 外部', url: getZohoPreviewUrl(rawPreviewUrl) },
        ].filter((item) => Boolean(item.url))
    }, [rawPreviewUrl])

    const [markdownMode, setMarkdownMode] = useState<MarkdownPreviewMode>('markdown')
    const [htmlMode, setHtmlMode] = useState<HtmlPreviewMode>('preview')
    const [csvMode, setCsvMode] = useState<CsvPreviewMode>('table')
    const [wrapText, setWrapText] = useState(true)
    const [rawMode, setRawMode] = useState(false)

    useEffect(() => {
        setMarkdownMode('markdown')
        setHtmlMode('preview')
        setCsvMode('table')
        setWrapText(true)
        setRawMode(false)
    }, [previewState.item.path])

    const renderExternalLinks = () => (
        externalPreviewLinks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
                {externalPreviewLinks.map((item) => (
                    <a
                        key={item.label}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm rounded-full"
                    >
                        {item.label}
                    </a>
                ))}
            </div>
        ) : null
    )

    if (isMarkdown) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && markdownMode === 'markdown' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setMarkdownMode('markdown')
                        }}
                    >
                        Markdown
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && markdownMode === 'markdown-wrap' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setMarkdownMode('markdown-wrap')
                        }}
                    >
                        Markdown with word wrap
                    </button>
                    {rawPreviewUrl && (
                        <button
                            type="button"
                            className={`btn btn-sm rounded-full ${rawMode ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setRawMode(true)}
                        >
                            浏览器原文
                        </button>
                    )}
                </div>

                {renderExternalLinks()}

                <div className="min-h-0 flex-1">
                    {rawMode && rawPreviewUrl ? (
                        <BrowserRawPreview title={previewState.item.name} src={rawPreviewUrl} />
                    ) : markdownMode === 'markdown' ? (
                        <div className="h-full overflow-auto rounded-2xl border border-base-300/70 bg-base-100 p-6 shadow-inner">
                            <article
                                className="prose prose-sm sm:prose lg:prose-lg max-w-none"
                                dangerouslySetInnerHTML={{ __html: previewState.htmlContent || '' }}
                            />
                        </div>
                    ) : (
                        <EditorView content={previewState.textContent || ''} wrap />
                    )}
                </div>
            </div>
        )
    }

    if (isHtml) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && htmlMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setHtmlMode('preview')
                        }}
                    >
                        HTML Preview
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && htmlMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setHtmlMode('editor')
                        }}
                    >
                        Text Editor
                    </button>
                    {rawPreviewUrl && (
                        <button
                            type="button"
                            className={`btn btn-sm rounded-full ${rawMode ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setRawMode(true)}
                        >
                            浏览器原文
                        </button>
                    )}
                </div>

                {renderExternalLinks()}

                <div className="min-h-0 flex-1">
                    {rawMode && rawPreviewUrl ? (
                        <BrowserRawPreview title={previewState.item.name} src={rawPreviewUrl} />
                    ) : htmlMode === 'preview' ? (
                        <iframe
                            srcDoc={previewState.htmlContent || ''}
                            sandbox="allow-same-origin"
                            title={previewState.item.name}
                            className="h-full w-full rounded-2xl border border-base-300/70 bg-white"
                        />
                    ) : (
                        <EditorView content={previewState.textContent || ''} wrap={wrapText} />
                    )}
                </div>
            </div>
        )
    }

    if (isCsv) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && csvMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setCsvMode('table')
                        }}
                    >
                        CSV Table
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${!rawMode && csvMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            setRawMode(false)
                            setCsvMode('editor')
                        }}
                    >
                        Text Editor
                    </button>
                    {rawPreviewUrl && (
                        <button
                            type="button"
                            className={`btn btn-sm rounded-full ${rawMode ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setRawMode(true)}
                        >
                            浏览器原文
                        </button>
                    )}
                </div>

                {renderExternalLinks()}

                <div className="min-h-0 flex-1">
                    {rawMode && rawPreviewUrl ? (
                        <BrowserRawPreview title={previewState.item.name} src={rawPreviewUrl} />
                    ) : csvMode === 'table' ? (
                        <div className="h-full overflow-auto rounded-2xl border border-base-300/70 bg-base-100 shadow-inner">
                            <table className="table table-zebra table-pin-rows">
                                <tbody>
                                    {(previewState.csvRows || []).map((row, rowIndex) => (
                                        <tr key={`${previewState.item.path}-${rowIndex}`}>
                                            {row.map((cell, cellIndex) => (
                                                <td key={`${rowIndex}-${cellIndex}`} className="whitespace-pre-wrap break-words align-top">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EditorView content={previewState.textContent || ''} wrap={wrapText} />
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className={`btn btn-sm rounded-full ${!rawMode ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setRawMode(false)}
                >
                    Text Editor
                </button>
                {rawPreviewUrl && (
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${rawMode ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setRawMode(true)}
                    >
                        浏览器原文
                    </button>
                )}
                <button
                    type="button"
                    className={`btn btn-sm rounded-full ${wrapText ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setWrapText((value) => !value)}
                >
                    {wrapText ? 'Word Wrap On' : 'Word Wrap Off'}
                </button>
            </div>

            {renderExternalLinks()}

            <div className="min-h-0 flex-1">
                {rawMode && rawPreviewUrl ? (
                    <BrowserRawPreview title={previewState.item.name} src={rawPreviewUrl} />
                ) : (
                    <EditorView content={previewState.textContent || ''} wrap={wrapText} />
                )}
            </div>
        </div>
    )
}
