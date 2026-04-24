'use client'

import { useEffect, useState } from 'react'
import type { DrivePreviewState, CsvPreviewMode, HtmlPreviewMode, MarkdownPreviewMode } from './types'
import { getFileExtension, isCsvExtension, isHtmlExtension, isMarkdownExtension } from './file-types'

type TextPreviewPanelProps = {
    previewState: DrivePreviewState
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
                {content || '暂无可显示文本内容'}
            </pre>
        </div>
    )
}

export function TextPreviewPanel({ previewState }: TextPreviewPanelProps) {
    const extension = getFileExtension(previewState.item.name)
    const isMarkdown = isMarkdownExtension(extension) || previewState.kind === 'markdown'
    const isHtml = isHtmlExtension(extension) || previewState.kind === 'html'
    const isCsv = isCsvExtension(extension) && Array.isArray(previewState.csvRows)

    const [markdownMode, setMarkdownMode] = useState<MarkdownPreviewMode>('markdown')
    const [htmlMode, setHtmlMode] = useState<HtmlPreviewMode>('preview')
    const [csvMode, setCsvMode] = useState<CsvPreviewMode>('table')
    const [wrapText, setWrapText] = useState(true)

    useEffect(() => {
        setMarkdownMode('markdown')
        setHtmlMode('preview')
        setCsvMode('table')
        setWrapText(true)
    }, [previewState.item.path])

    if (isMarkdown) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${markdownMode === 'markdown' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setMarkdownMode('markdown')}
                    >
                        Markdown
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${markdownMode === 'markdown-wrap' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setMarkdownMode('markdown-wrap')}
                    >
                        Markdown with word wrap
                    </button>
                </div>

                <div className="min-h-0 flex-1">
                    {markdownMode === 'markdown' ? (
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
                        className={`btn btn-sm rounded-full ${htmlMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setHtmlMode('preview')}
                    >
                        HTML Preview
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${htmlMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setHtmlMode('editor')}
                    >
                        Text Editor
                    </button>
                </div>

                <div className="min-h-0 flex-1">
                    {htmlMode === 'preview' ? (
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
                        className={`btn btn-sm rounded-full ${csvMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCsvMode('table')}
                    >
                        CSV Table
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm rounded-full ${csvMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCsvMode('editor')}
                    >
                        Text Editor
                    </button>
                </div>

                <div className="min-h-0 flex-1">
                    {csvMode === 'table' ? (
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
                    className={`btn btn-sm rounded-full ${wrapText ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setWrapText((value) => !value)}
                >
                    {wrapText ? 'Word Wrap On' : 'Word Wrap Off'}
                </button>
            </div>
            <div className="min-h-0 flex-1">
                <EditorView content={previewState.textContent || ''} wrap={wrapText} />
            </div>
        </div>
    )
}
