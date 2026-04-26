'use client'

/**
 * @file DrivePageOverlays.tsx
 * @description 网盘页面的全局浮层组件，管理吐司通知 (Sonner)、文件上传输入框、预览模态框以及加载遮罩。
 */

import { useEffect, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import gsap from 'gsap'
import { DrivePreviewModal } from './preview/DrivePreviewModal'
import type { DrivePageController } from './useDrivePageController'

type DrivePageOverlaysProps = {
    /** 网盘页面控制器实例 */
    controller: DrivePageController
}

/**
 * 预览加载遮罩组件
 * 当文件信息正在从服务器获取，但预览窗口尚未弹出时显示。
 * 使用 GSAP 提供优雅的入场动画。
 */
function PreviewLoadingOverlay() {
    const backdropRef = useRef<HTMLDivElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const backdrop = backdropRef.current
        const card = cardRef.current
        if (!backdrop || !card) return

        // 设置初始不可见状态（内联 style 辅助首帧隐藏）
        gsap.set(backdrop, { opacity: 0 })
        gsap.set(card, { opacity: 0, scale: 0.85, y: 20 })

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl
            // 背景遮罩淡入
            .to(backdrop, { opacity: 1, duration: 0.3 })
            // 加载卡片弹性回弹弹出
            .to(card, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.6)' }, '-=0.15')

        return () => {
            tl.kill()
        }
    }, [])

    return (
        <div ref={backdropRef} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 backdrop-blur-sm" style={{ opacity: 0 }}>
            <div ref={cardRef} className="rounded-3xl border border-white/10 bg-base-100/95 px-6 py-5 shadow-2xl" style={{ opacity: 0, transform: 'scale(0.85) translateY(20px)' }}>
                <div className="flex items-center gap-3 text-base-content/75">
                    <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                    正在打开预览...
                </div>
            </div>
        </div>
    )
}

/**
 * 网盘全局浮层渲染组件
 */
export function DrivePageOverlays({ controller }: DrivePageOverlaysProps) {
    return (
        <>
            {/* 全局消息提醒 (Toaster) */}
            <Toaster
                richColors
                theme={controller.toastTheme}
                position="top-center"
                offset={112}
                visibleToasts={6}
                expand={true}
                toastOptions={{
                    className: '!flex-row flex !items-center shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
                    style: {
                        fontSize: '1rem',
                        padding: '14px 20px',
                        zIndex: '999999',
                        borderRadius: '14px',
                    },
                    duration: 5000,
                    closeButton: false,
                }}
            />

            {/* 隐藏的文件上传原声 Input */}
            <input
                ref={controller.uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    void controller.handleUpload(event.target.files)
                }}
            />

            {/* 核心文件预览模态框 */}
            {controller.previewState && (
                <DrivePreviewModal
                    previewState={controller.previewState}
                    onClose={() => controller.setPreviewState(null)}
                    onDownload={() => {
                        void controller.downloadFileEntry(controller.previewState!.entry)
                    }}
                    onCopyDownloadLink={() => {
                        void controller.copyItemDownloadLink(controller.previewState!.item)
                    }}
                    onOpenInPotPlayer={() => {
                        controller.openItemInPotPlayer(controller.previewState!.item)
                    }}
                />
            )}

            {/* 当正在解析文件且预览尚未准备好时显示的加载状态 */}
            {controller.previewLoading && !controller.previewState && (
                <PreviewLoadingOverlay />
            )}
        </>
    )
}
