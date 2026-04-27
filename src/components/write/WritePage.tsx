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
    const [toastTheme, setToastTheme] = useState<'light' | 'dark'>('light')

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

    useEffect(() => {
        const root = document.documentElement

        const syncToastTheme = () => {
            setToastTheme(root.getAttribute('data-theme-type') === 'dark' ? 'dark' : 'light')
        }

        syncToastTheme()

        const handleThemeChange = (event: Event) => {
            const detail = (event as CustomEvent<{ themeType?: string }>).detail
            setToastTheme(detail?.themeType === 'dark' ? 'dark' : 'light')
        }

        const observer = new MutationObserver(syncToastTheme)

        window.addEventListener('mahiro:theme-change', handleThemeChange)
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-theme-type'],
        })

        return () => {
            window.removeEventListener('mahiro:theme-change', handleThemeChange)
            observer.disconnect()
        }
    }, [])

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
                ; (e as any).returnValue = ''
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
                theme={toastTheme}
                position="top-center"
                offset={80}
                visibleToasts={6}
                expand={true}
                richColors
                gap={10}
                style={{ zIndex: 999999 }}
                toastOptions={{
                    className: 'sonner-toast-custom',
                    classNames: {
                        toast: '!flex-row flex !items-center shadow-2xl !rounded-2xl !backdrop-blur-xl !bg-base-100/90 border border-base-300/50',
                        default: '!text-base-content',
                        error: '!text-error font-semibold',
                        success: '!text-success font-semibold',
                        warning: '!text-warning font-semibold',
                        info: '!text-info font-semibold',
                    },
                    style: {
                        fontSize: '0.95rem',
                        padding: '14px 22px',
                    },
                    duration: 4000,
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
