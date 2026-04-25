'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DrivePreviewState, OfficePreviewProviderId } from './types'

type OfficePreviewPanelProps = {
    previewState: DrivePreviewState
}

type PreviewSource = 'parsed' | OfficePreviewProviderId

function OnlinePreviewFrame({ title, src }: { title: string; src: string }) {
    return (
        <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-base-300/70 bg-base-100 shadow-inner">
            <iframe
                src={src}
                title={title}
                className="h-full w-full border-0"
                loading="lazy"
                allowFullScreen
            />
        </div>
    )
}

function ExternalPreviewCard({ label, url }: { label: string; url: string }) {
    return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="w-full max-w-2xl rounded-3xl border border-base-300/70 bg-base-100 p-8 text-center shadow-inner">
                <div className="text-xl font-bold text-base-content">{label}</div>
                <p className="mt-3 text-sm leading-7 text-base-content/65">
                    该预览源通常不允许被站内 iframe 直接嵌入，请在新窗口中打开查看。
                </p>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary mt-5 rounded-full"
                >
                    在新窗口打开
                </a>
            </div>
        </div>
    )
}

export function OfficePreviewPanel({ previewState }: OfficePreviewPanelProps) {
    const officeData = previewState.officeData
    const [activeSheet, setActiveSheet] = useState(0)
    const [previewSource, setPreviewSource] = useState<PreviewSource>('parsed')

    useEffect(() => {
        setActiveSheet(0)
        setPreviewSource('parsed')
    }, [previewState.item.path])

    const onlinePreviews = officeData?.onlinePreviews || []
    const activeOnlinePreview = useMemo(
        () => onlinePreviews.find((provider) => provider.id === previewSource),
        [onlinePreviews, previewSource],
    )

    if (!officeData) {
        return (
            <div className="flex h-full items-center justify-center p-8 text-base-content/60">
                当前文档没有可显示的预览内容。
            </div>
        )
    }

    const renderPreviewSwitcher = () => (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                className={`btn btn-sm rounded-full ${previewSource === 'parsed' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPreviewSource('parsed')}
            >
                本地解析
            </button>
            {onlinePreviews.map((provider) => (
                <button
                    key={provider.id}
                    type="button"
                    className={`btn btn-sm rounded-full ${previewSource === provider.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setPreviewSource(provider.id)}
                >
                    {provider.label}
                </button>
            ))}
        </div>
    )

    if (officeData.format === 'xlsx') {
        const sheets = officeData.sheets || []
        const currentSheet = sheets[activeSheet]

        return (
            <div className="flex h-full flex-col gap-4 p-5">
                {renderPreviewSwitcher()}

                {activeOnlinePreview ? (
                    activeOnlinePreview.mode === 'embed' ? (
                        <OnlinePreviewFrame title={previewState.item.name} src={activeOnlinePreview.url} />
                    ) : (
                        <ExternalPreviewCard label={activeOnlinePreview.label} url={activeOnlinePreview.url} />
                    )
                ) : (
                    <>
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

                        {sheets.length > 0 && (
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
                        )}
                    </>
                )}
            </div>
        )
    }

    if (officeData.format === 'pptx') {
        const slides = officeData.slides || []

        return (
            <div className="flex h-full flex-col gap-4 p-5">
                {renderPreviewSwitcher()}

                {activeOnlinePreview ? (
                    activeOnlinePreview.mode === 'embed' ? (
                        <OnlinePreviewFrame title={previewState.item.name} src={activeOnlinePreview.url} />
                    ) : (
                        <ExternalPreviewCard label={activeOnlinePreview.label} url={activeOnlinePreview.url} />
                    )
                ) : slides.length > 0 ? (
                    <div className="min-h-0 flex-1 overflow-auto">
                        <div className="grid gap-4">
                            {slides.map((slide, index) => (
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
                ) : (
                    <div className="rounded-2xl border border-base-300/70 bg-base-100 p-6 text-sm leading-7 text-base-content/65 shadow-inner">
                        当前 PPT 暂时无法完整解析，请切换到上方的在线预览源查看。
                    </div>
                )}
            </div>
        )
    }

    if (activeOnlinePreview) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                {renderPreviewSwitcher()}
                {activeOnlinePreview.mode === 'embed' ? (
                    <OnlinePreviewFrame title={previewState.item.name} src={activeOnlinePreview.url} />
                ) : (
                    <ExternalPreviewCard label={activeOnlinePreview.label} url={activeOnlinePreview.url} />
                )}
            </div>
        )
    }

    if (officeData.html) {
        return (
            <div className="flex h-full flex-col gap-4 p-5">
                {onlinePreviews.length > 0 && renderPreviewSwitcher()}
                <div className="min-h-0 flex-1 overflow-auto">
                    <article
                        className="prose prose-sm sm:prose lg:prose-lg max-w-none rounded-2xl border border-base-300/70 bg-base-100 p-6 shadow-inner"
                        dangerouslySetInnerHTML={{ __html: officeData.html }}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-4 p-5">
            {onlinePreviews.length > 0 && renderPreviewSwitcher()}
            <div className="min-h-0 flex-1 overflow-auto">
                <pre className="min-h-full whitespace-pre-wrap break-words rounded-2xl border border-base-300/70 bg-base-100 p-5 font-mono text-sm leading-7 text-base-content shadow-inner">
                    {officeData.text || '当前文档没有可显示的文本内容。'}
                </pre>
            </div>
        </div>
    )
}
