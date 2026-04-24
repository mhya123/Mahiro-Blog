'use client'

import { useEffect, useState } from 'react'
import type { DrivePreviewState } from './types'

type OfficePreviewPanelProps = {
    previewState: DrivePreviewState
}

export function OfficePreviewPanel({ previewState }: OfficePreviewPanelProps) {
    const officeData = previewState.officeData
    const [activeSheet, setActiveSheet] = useState(0)

    useEffect(() => {
        setActiveSheet(0)
    }, [previewState.item.path])

    if (!officeData) {
        return (
            <div className="flex h-full items-center justify-center p-8 text-base-content/60">
                当前文档没有可显示的预览内容。
            </div>
        )
    }

    if (officeData.format === 'xlsx') {
        const sheets = officeData.sheets || []
        const currentSheet = sheets[activeSheet]

        return (
            <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    {sheets.map((sheet, index) => (
                        <button
                            key={sheet.name}
                            type="button"
                            className={`btn btn-sm rounded-full ${index === activeSheet ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveSheet(index)}
                        >
                            {sheet.name}
                        </button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-base-300/70 bg-base-100 p-4 shadow-inner">
                    {currentSheet ? (
                        <div
                            className="overflow-x-auto [&_table]:table [&_table]:table-zebra [&_table]:w-full [&_td]:border [&_td]:border-base-300/70 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-base-300/70 [&_th]:bg-base-200 [&_th]:px-3 [&_th]:py-2"
                            dangerouslySetInnerHTML={{ __html: currentSheet.html }}
                        />
                    ) : (
                        <div className="text-base-content/60">当前表格没有可显示的工作表。</div>
                    )}
                </div>
            </div>
        )
    }

    if (officeData.format === 'pptx') {
        return (
            <div className="h-full overflow-auto p-5">
                <div className="grid gap-4">
                    {(officeData.slides || []).map((slide, index) => (
                        <section key={`${previewState.item.path}-${index}`} className="rounded-3xl border border-base-300/70 bg-base-100 p-6 shadow-inner">
                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">
                                Slide {index + 1}
                            </div>
                            <h3 className="text-xl font-bold text-base-content">{slide.title}</h3>
                            {slide.body.length > 0 && (
                                <ul className="mt-4 space-y-2 text-sm leading-7 text-base-content/75">
                                    {slide.body.map((line, lineIndex) => (
                                        <li key={`${index}-${lineIndex}`} className="rounded-2xl bg-base-200/50 px-4 py-3">
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        )
    }

    if (officeData.html) {
        return (
            <div className="h-full overflow-auto p-5">
                <article
                    className="prose prose-sm sm:prose lg:prose-lg max-w-none rounded-2xl border border-base-300/70 bg-base-100 p-6 shadow-inner"
                    dangerouslySetInnerHTML={{ __html: officeData.html }}
                />
            </div>
        )
    }

    return (
        <div className="h-full overflow-auto p-5">
            <pre className="min-h-full whitespace-pre-wrap break-words rounded-2xl border border-base-300/70 bg-base-100 p-5 font-mono text-sm leading-7 text-base-content shadow-inner">
                {officeData.text || '当前文档没有可显示的文本内容。'}
            </pre>
        </div>
    )
}
