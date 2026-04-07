'use client'

import { useWriteStore } from './stores/write-store'
import { usePreviewStore } from './stores/preview-store'
import { WriteEditor } from './components/editor'
import { WriteSidebar } from './components/sidebar'
import { WriteActions } from './components/actions'
import { WritePreview } from './components/preview'
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { useLoadBlog } from './hooks/use-load-blog'
import type { AiModelDefinition } from '@/lib/ai-models'
import type { PublishForm } from './types'
import { WRITE_DRAFT_STORAGE_KEY, isDraftFormMeaningful } from './constants'

type WritePageProps = {
    categories?: string[]
    aiModels?: AiModelDefinition[]
}

export default function WritePage({ categories = [], aiModels = [] }: WritePageProps) {
    const { form, cover, mode, reset, setForm } = useWriteStore()
    const { isPreview, closePreview } = usePreviewStore()
    const [slug, setSlug] = useState<string | null>(null)
    const [shouldRenderPreview, setShouldRenderPreview] = useState(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const s = params.get('slug')
        if (s) {
            setSlug(s)
        } else {
            reset()
        }
    }, [])

    useLoadBlog(slug || undefined)

    // 创建模式：自动恢复草稿
    useEffect(() => {
        if (slug) return

        try {
            const raw = localStorage.getItem(WRITE_DRAFT_STORAGE_KEY)
            if (!raw) return

            const parsed = JSON.parse(raw) as { form?: PublishForm; updatedAt?: number }
            if (!parsed?.form || !isDraftFormMeaningful(parsed.form)) return

            setForm(parsed.form)
            const tip = parsed.updatedAt
                ? `已恢复草稿（${new Date(parsed.updatedAt).toLocaleString('zh-CN')}）`
                : '已恢复本地草稿'
            toast.info(tip)
        } catch {
            // ignore broken draft cache
        }
    }, [slug, setForm])

    // 创建模式：自动保存草稿（防抖）
    useEffect(() => {
        if (mode !== 'create') return

        const timer = window.setTimeout(() => {
            try {
                if (!isDraftFormMeaningful(form)) {
                    localStorage.removeItem(WRITE_DRAFT_STORAGE_KEY)
                    return
                }
                localStorage.setItem(
                    WRITE_DRAFT_STORAGE_KEY,
                    JSON.stringify({ form, updatedAt: Date.now() }),
                )
            } catch {
                // ignore storage quota/security errors
            }
        }, 600)

        return () => window.clearTimeout(timer)
    }, [form, mode])

    // 创建模式：未保存离开提醒
    useEffect(() => {
        if (mode !== 'create') return

        const handler = (e: BeforeUnloadEvent) => {
            if (!isDraftFormMeaningful(form)) return
            e.preventDefault()
            ;(e as any).returnValue = ''
        }

        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [form, mode])

    useEffect(() => {
        if (isPreview) {
            setShouldRenderPreview(true)
        }
    }, [isPreview])

    const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

    return (
        <>
            <Toaster
                richColors
                position="top-center"
                offset={120}
                toastOptions={{
                    className: 'shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
                    style: {
                        fontSize: '1rem',
                        padding: '14px 20px',
                        zIndex: '999999',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.3s ease-in-out',
                    },
                    classNames: {
                        title: 'text-lg font-semibold tracking-tight',
                        description: 'text-sm font-medium opacity-90',
                        error: 'bg-error/95 text-error-content border-error/30',
                        success: 'bg-success/95 text-success-content border-success/30',
                        warning: 'bg-warning/95 text-warning-content border-warning/30',
                        info: 'bg-info/95 text-info-content border-info/30',
                    },
                    duration: 5000,
                    closeButton: false,
                }}
            />
            <div className='relative'>
                <div className='flex flex-col md:flex-row h-full justify-center gap-6 px-4 md:px-6 pt-24 pb-12'>
                    <WriteEditor />
                    <WriteSidebar categories={categories} aiModels={aiModels} />
                </div>

                <WriteActions />

                {shouldRenderPreview && (
                    <WritePreview
                        isOpen={isPreview}
                        form={form}
                        coverPreviewUrl={coverPreviewUrl}
                        onRequestClose={closePreview}
                        onExited={() => setShouldRenderPreview(false)}
                    />
                )}
            </div>
        </>
    )
}
