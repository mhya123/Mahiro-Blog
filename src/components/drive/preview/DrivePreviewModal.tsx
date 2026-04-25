'use client'

import { useEffect, useState } from 'react'
import { Copy, Download, ExternalLink, FileAudio2, FileText, X } from 'lucide-react'
import type { DrivePreviewState, VideoPreviewMode } from './types'
import { ArchivePreviewPanel } from './ArchivePreviewPanel'
import { OfficePreviewPanel } from './OfficePreviewPanel'
import { TextPreviewPanel } from './TextPreviewPanel'
import { Video360Preview } from './Video360Preview'

type DrivePreviewModalProps = {
    previewState: DrivePreviewState
    onClose: () => void
    onDownload: () => void
    onCopyDownloadLink?: () => void
    onOpenInPotPlayer?: () => void
}

function formatTime(value: string) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString('zh-CN', { hour12: false })
}

export function DrivePreviewModal({ previewState, onClose, onDownload, onCopyDownloadLink, onOpenInPotPlayer }: DrivePreviewModalProps) {
    const [videoMode, setVideoMode] = useState<VideoPreviewMode>('video')
    const canOpenInPotPlayer = Boolean(onOpenInPotPlayer) && (previewState.kind === 'video' || previewState.kind === 'audio')

    useEffect(() => {
        setVideoMode('video')
    }, [previewState.item.path])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = ''
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    return (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="flex h-[min(88vh,960px)] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-base-300/60 px-5 py-4">
                    <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-base-content">
                            {previewState.item.name}
                        </div>
                        <div className="mt-1 text-xs text-base-content/55">
                            {previewState.item.type} · {previewState.item.sizeLabel} · {formatTime(previewState.item.modified)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {previewState.kind === 'video' && (
                            <>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-full ${videoMode === 'video' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setVideoMode('video')}
                                >
                                    video
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-full ${videoMode === 'video360' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setVideoMode('video360')}
                                >
                                    video360
                                </button>
                            </>
                        )}

                        {canOpenInPotPlayer && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm rounded-full"
                                onClick={onOpenInPotPlayer}
                            >
                                <ExternalLink className="h-4 w-4" />
                                PotPlayer
                            </button>
                        )}

                        {onCopyDownloadLink && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm rounded-full"
                                onClick={onCopyDownloadLink}
                            >
                                <Copy className="h-4 w-4" />
                                复制链接
                            </button>
                        )}

                        <button type="button" className="btn btn-ghost btn-sm rounded-full" onClick={onDownload}>
                            <Download className="h-4 w-4" />
                            下载
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={onClose}
                            aria-label="关闭预览"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 bg-base-200/30">
                    {previewState.kind === 'image' && (
                        <div className="flex h-full items-center justify-center overflow-auto p-4">
                            <img
                                src={previewState.url}
                                alt={previewState.item.name}
                                className="max-h-full max-w-full rounded-2xl object-contain shadow-xl"
                            />
                        </div>
                    )}

                    {previewState.kind === 'video' && (
                        <div className="h-full p-4">
                            {videoMode === 'video360' ? (
                                <Video360Preview src={previewState.url} />
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <video
                                        src={previewState.url}
                                        controls
                                        className="max-h-full max-w-full rounded-2xl bg-black shadow-xl"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {previewState.kind === 'audio' && (
                        <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
                            <FileAudio2 className="h-16 w-16 text-primary" />
                            <div className="text-base-content/70">{previewState.item.name}</div>
                            <audio src={previewState.url} controls className="w-full max-w-2xl" />
                        </div>
                    )}

                    {previewState.kind === 'pdf' && (
                        <iframe
                            src={previewState.url}
                            title={previewState.item.name}
                            className="h-full w-full border-0"
                        />
                    )}

                    {(previewState.kind === 'text' || previewState.kind === 'markdown' || previewState.kind === 'html') && (
                        <TextPreviewPanel previewState={previewState} />
                    )}

                    {previewState.kind === 'office' && (
                        <OfficePreviewPanel previewState={previewState} />
                    )}

                    {previewState.kind === 'archive' && (
                        <ArchivePreviewPanel previewState={previewState} />
                    )}

                    {previewState.kind === 'unsupported' && (
                        <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
                            <FileText className="h-16 w-16 text-base-content/35" />
                            <div className="space-y-2">
                                <div className="text-xl font-bold text-base-content">暂不支持站内预览</div>
                                <div className="max-w-lg text-sm leading-7 text-base-content/65">
                                    {previewState.message || '该文件类型暂不支持站内预览，请使用下载。'}
                                </div>
                            </div>
                            <button type="button" className="btn btn-primary rounded-full" onClick={onDownload}>
                                <Download className="h-4 w-4" />
                                下载文件
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
