'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useDriveState } from './hooks/useDriveState'
import { useDriveNavigation } from './hooks/useDriveNavigation'
import { useDriveMutations } from './hooks/useDriveMutations'
import { useDrivePreview } from './hooks/useDrivePreview'
import { describeDriveError, requestDriveJson } from './page-http'
import { DEFAULT_PERMISSIONS, getPermissionLabel, getVisiblePages, normalizePath, splitBreadcrumbs } from './page-utils'
import type { DrivePermissions, DriveStatus, DriveEntry } from './types'

type DrivePageProps = {
    permissions?: Partial<DrivePermissions>
}

export function useDrivePageController({ permissions }: DrivePageProps) {
    const configuredPermissions: DrivePermissions = {
        ...DEFAULT_PERMISSIONS,
        ...(permissions || {}),
    }

    const stateContext = useDriveState()
    const { status, currentPath, totalCount, currentPage, perPage, items, selectedPaths } = stateContext

    const serverPermissions: DrivePermissions = {
        ...DEFAULT_PERMISSIONS,
        ...(status?.permissions || {}),
    }

    const effectivePermissions: DrivePermissions = {
        upload: configuredPermissions.upload && serverPermissions.upload,
        mkdir: configuredPermissions.mkdir && serverPermissions.mkdir,
        view: configuredPermissions.view && serverPermissions.view,
        download: configuredPermissions.download && serverPermissions.download,
        rename: configuredPermissions.rename && serverPermissions.rename,
        copy: configuredPermissions.copy && serverPermissions.copy,
        move: configuredPermissions.move && serverPermissions.move,
        remove: configuredPermissions.remove && serverPermissions.remove,
    }

    const nav = useDriveNavigation({ permissions: effectivePermissions, state: stateContext })
    const mutations = useDriveMutations({ permissions: effectivePermissions, state: stateContext, loadDirectory: nav.loadDirectory })
    const preview = useDrivePreview({ permissions: effectivePermissions, state: stateContext })

    useEffect(() => {
        let cancelled = false

        async function bootstrap() {
            try {
                const nextStatus = await requestDriveJson<DriveStatus>('status')
                if (cancelled) return

                stateContext.setStatus(nextStatus)
                stateContext.setPageError('')
                if (!nextStatus.configured) {
                    stateContext.setLoading(false)
                    return
                }
                if (!(configuredPermissions.view && (nextStatus.permissions?.view ?? true))) {
                    stateContext.setLoading(false)
                    return
                }
                const urlParams = new URLSearchParams(window.location.search)
                const urlDir = urlParams.get('dir')
                const rootPath = normalizePath(urlDir || nextStatus.defaultRoot || '/')
                await nav.loadDirectory(rootPath, { silent: false })
            } catch (error) {
                if (!cancelled) {
                    const message = describeDriveError(error, '网盘初始化失败')
                    stateContext.setPageError(message)
                    toast.error(message)
                    stateContext.setLoading(false)
                }
            }
        }

        void bootstrap()

        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search)
            const dir = urlParams.get('dir') || '/'
            void nav.loadDirectory(dir, { silent: true, isPopState: true })
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            cancelled = true
            window.removeEventListener('popstate', handlePopState)
        }
    }, [])

    useEffect(() => {
        const root = document.documentElement

        const syncToastTheme = () => {
            stateContext.setToastTheme(root.getAttribute('data-theme-type') === 'dark' ? 'dark' : 'light')
        }

        syncToastTheme()

        const handleThemeChange = (event: Event) => {
            const detail = (event as CustomEvent<{ themeType?: string }>).detail
            stateContext.setToastTheme(detail?.themeType === 'dark' ? 'dark' : 'light')
        }

        const observer = new MutationObserver(() => {
            syncToastTheme()
        })

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

    function openEntry(entry: DriveEntry) {
        if (entry.isDir) {
            if (!effectivePermissions.view) {
                toast.error(`当前权限不允许${getPermissionLabel('view')}。`)
                return
            }
            void nav.loadDirectory(entry.path, { silent: false, page: 1 })
            return
        }

        void preview.openFileEntry(entry)
    }

    function toggleSelected(path: string) {
        const next = new Set(selectedPaths)
        if (next.has(path)) {
            next.delete(path)
        } else {
            next.add(path)
        }
        stateContext.setSelectedPaths(next)
    }

    const selectedEntries = items.filter((entry) => selectedPaths.has(entry.path))
    const breadcrumbs = splitBreadcrumbs(currentPath)
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
    const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1
    const endIndex = totalCount === 0 ? 0 : Math.min(currentPage * perPage, totalCount)
    const visiblePages = getVisiblePages(currentPage, totalPages)

    return {
        // State
        ...stateContext,
        effectivePermissions,
        
        // Computed
        selectedEntries,
        breadcrumbs,
        totalPages,
        startIndex,
        endIndex,
        visiblePages,

        // Actions
        ...nav,
        ...mutations,
        ...preview,
        openEntry,
        toggleSelected,
    }
}

export type DrivePageController = ReturnType<typeof useDrivePageController>

