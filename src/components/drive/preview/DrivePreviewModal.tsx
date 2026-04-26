'use client'

/**
 * @file DrivePreviewModal.tsx
 * @description 网盘文件预览模态框组件，支持多种文件类型预览（图片、视频、音频、PDF、代码、Office、压缩包等）。
 * 使用 GSAP 实现高性能、细腻的进退场动画效果。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Download, ExternalLink, FileAudio2, FileText, X } from 'lucide-react'
import gsap from 'gsap'
import type { DrivePreviewState, VideoPreviewMode } from './types'
import { ArchivePreviewPanel } from './ArchivePreviewPanel'
import { OfficePreviewPanel } from './OfficePreviewPanel'
import { TextPreviewPanel } from './TextPreviewPanel'
import { Video360Preview } from './Video360Preview'

/**
 * 预览模态框属性定义
 */
type DrivePreviewModalProps = {
    /** 预览状态，包含文件信息、URL 及其展示类型 */
    previewState: DrivePreviewState
    /** 关闭模态框的回调 */
    onClose: () => void
    /** 下载文件的回调 */
    onDownload: () => void
    /** 复制下载链接的回调（可选） */
    onCopyDownloadLink?: () => void
    /** 使用本地 PotPlayer 播放的回调（针对音视频） */
    onOpenInPotPlayer?: () => void
}

/**
 * 格式化时间显示
 * @param value ISO 时间字符串
 */
function formatTime(value: string) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString('zh-CN', { hour12: false })
}

/**
 * 网盘预览模态框主组件
 */
export function DrivePreviewModal({ previewState, onClose, onDownload, onCopyDownloadLink, onOpenInPotPlayer }: DrivePreviewModalProps) {
    // 状态控制：音视频预览模式（普通视频 vs 360全景视频）
    const [videoMode, setVideoMode] = useState<VideoPreviewMode>('video')
    const canOpenInPotPlayer = Boolean(onOpenInPotPlayer) && (previewState.kind === 'video' || previewState.kind === 'audio')

    // 动画引用的 DOM 节点
    const overlayRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // 状态标记：是否正在执行关闭动画，防止重复触发
    const isClosingRef = useRef(false)
    const tlRef = useRef<gsap.core.Timeline | null>(null)

    // 当预览文件变换时，重置视频预览模式
    useEffect(() => {
        setVideoMode('video')
    }, [previewState.item.path])

    /**
     * ── GSAP 入场动画 ──
     * 编排背景淡入、面板弹出以及内部元素的顺序展示
     */
    useEffect(() => {
        const overlay = overlayRef.current
        const panel = panelRef.current
        const header = headerRef.current
        const content = contentRef.current
        if (!overlay || !panel || !header || !content) return

        // 1. 设置初始状态（配合内联 style 确保首帧不闪烁）
        gsap.set(overlay, { opacity: 0 })
        gsap.set(panel, {
            opacity: 0,
            scale: 0.88,
            y: 60,
            rotateX: 4,
        })
        gsap.set(header, { opacity: 0, y: -16 })
        gsap.set(content, { opacity: 0, y: 24 })

        const tl = gsap.timeline({
            defaults: { ease: 'power3.out' },
        })

        tl
            // 背景遮罩层平滑淡入
            .to(overlay, {
                opacity: 1,
                duration: 0.35,
            })
            // 弹窗面板从底部滑入、放大并归正（Back 缓动增加动感）
            .to(panel, {
                opacity: 1,
                scale: 1,
                y: 0,
                rotateX: 0,
                duration: 0.5,
                ease: 'back.out(1.4)',
            }, '-=0.22')
            // 头部文件名/操作区淡入
            .to(header, {
                opacity: 1,
                y: 0,
                duration: 0.35,
            }, '-=0.28')
            // 内容区域（图片/视频/文本）最后淡入
            .to(content, {
                opacity: 1,
                y: 0,
                duration: 0.4,
            }, '-=0.18')

        tlRef.current = tl

        return () => {
            tl.kill()
        }
    }, [])

    /**
     * ── GSAP 退场动画 ──
     * 先播放收缩淡出动画，待动画完成后再真正触发逻辑层关闭
     */
    const handleClose = useCallback(() => {
        if (isClosingRef.current) return
        isClosingRef.current = true

        const overlay = overlayRef.current
        const panel = panelRef.current
        if (!overlay || !panel) {
            onClose()
            return
        }

        const exitTl = gsap.timeline({
            onComplete: () => {
                onClose()
            },
        })

        exitTl
            // 面板缩小、向下沉入并消失
            .to(panel, {
                opacity: 0,
                scale: 0.9,
                y: 40,
                duration: 0.3,
                ease: 'power2.in',
            })
            // 背景层同步淡出
            .to(overlay, {
                opacity: 0,
                duration: 0.22,
            }, '-=0.12')
    }, [onClose])

    /**
     * 系统交互优化
     * 1. 禁用 body 滚动以提升沉浸感
     * 2. 监听 Escape 键快速关闭预览
     */
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose()
            }
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = ''
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleClose])

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
            style={{ perspective: '1200px', opacity: 0 }}
            onClick={handleClose}
        >
            <div
                ref={panelRef}
                className="flex h-[min(88vh,960px)] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-2xl"
                style={{
                    transformOrigin: 'center bottom',
                    willChange: 'transform, opacity',
                    opacity: 0,
                    transform: 'scale(0.88) translateY(60px) rotateX(4deg)'
                }}
                onClick={(event) => event.stopPropagation()}
            >
                {/* 顶部标题与工具栏 */}
                <div
                    ref={headerRef}
                    className="flex items-center justify-between gap-3 border-b border-base-300/60 px-5 py-4"
                    style={{ opacity: 0, transform: 'translateY(-16px)' }}
                >
                    <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-base-content">
                            {previewState.item.name}
                        </div>
                        <div className="mt-1 text-xs text-base-content/55">
                            {previewState.item.type} · {previewState.item.sizeLabel} · {formatTime(previewState.item.modified)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 视频特有控制：普通模式 vs 360全景 */}
                        {previewState.kind === 'video' && (
                            <>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-full ${videoMode === 'video' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setVideoMode('video')}
                                >
                                    视频
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-full ${videoMode === 'video360' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setVideoMode('video360')}
                                >
                                    全景
                                </button>
                            </>
                        )}

                        {/* PotPlayer 连接 */}
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

                        {/* 直链复制 */}
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

                        {/* 文件下载 */}
                        <button type="button" className="btn btn-ghost btn-sm rounded-full" onClick={onDownload}>
                            <Download className="h-4 w-4" />
                            下载
                        </button>

                        {/* 关闭按钮 */}
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={handleClose}
                            aria-label="关闭预览"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* 预览主内容区 */}
                <div
                    ref={contentRef}
                    className="min-h-0 flex-1 bg-base-200/30"
                    style={{ opacity: 0, transform: 'translateY(24px)' }}
                >
                    {/* 图片预览 */}
                    {previewState.kind === 'image' && (
                        <div className="flex h-full items-center justify-center overflow-auto p-4">
                            <img
                                src={previewState.url}
                                alt={previewState.item.name}
                                className="max-h-full max-w-full rounded-2xl object-contain shadow-xl"
                            />
                        </div>
                    )}

                    {/* 视频预览（支持 360 回放） */}
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

                    {/* 音频预览 */}
                    {previewState.kind === 'audio' && (
                        <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
                            <FileAudio2 className="h-16 w-16 text-primary" />
                            <div className="text-base-content/70">{previewState.item.name}</div>
                            <audio src={previewState.url} controls className="w-full max-w-2xl" />
                        </div>
                    )}

                    {/* PDF 预览（使用 iframe） */}
                    {previewState.kind === 'pdf' && (
                        <iframe
                            src={previewState.url}
                            title={previewState.item.name}
                            className="h-full w-full border-0"
                        />
                    )}

                    {/* 文本/源码/Markdown 预览 */}
                    {(previewState.kind === 'text' || previewState.kind === 'markdown' || previewState.kind === 'html') && (
                        <TextPreviewPanel previewState={previewState} />
                    )}

                    {/* Office 文档预览 */}
                    {previewState.kind === 'office' && (
                        <OfficePreviewPanel previewState={previewState} />
                    )}

                    {/* 压缩包预览 */}
                    {previewState.kind === 'archive' && (
                        <ArchivePreviewPanel previewState={previewState} />
                    )}

                    {/* 不支持预览的占位显示 */}
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
