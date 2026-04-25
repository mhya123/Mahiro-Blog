'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SITE_API_BASE_URL } from '@/consts'
import { buildDriveFileUrl, buildPotPlayerUrl, copyTextToClipboard, triggerExternalUrl } from './page-actions'
import { describeDriveError, requestDriveJson } from './page-http'
import {
    DEFAULT_PERMISSIONS,
    getParentPath,
    getPermissionLabel,
    getVisiblePages,
    joinPath,
    normalizePath,
    splitBreadcrumbs,
} from './page-utils'
import type { DriveEntry, DriveItemPayload, DriveListPayload, DrivePermissions, DriveStatus } from './types'
import type { DrivePreviewState } from './preview/types'
import { getPreviewKind } from './preview/file-types'
import { loadDrivePreview } from './preview/loaders'

type DrivePageProps = {
    permissions?: Partial<DrivePermissions>
}

export function useDrivePageController({ permissions }: DrivePageProps) {
    const configuredPermissions: DrivePermissions = {
        ...DEFAULT_PERMISSIONS,
        ...(permissions || {}),
    }

    const [toastTheme, setToastTheme] = useState<'light' | 'dark'>('light')
    const [status, setStatus] = useState<DriveStatus | null>(null)
    const [currentPath, setCurrentPath] = useState('/')
    const [items, setItems] = useState<DriveEntry[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [perPage, setPerPage] = useState(20)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewState, setPreviewState] = useState<DrivePreviewState | null>(null)
    const [pageError, setPageError] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchInput, setSearchInput] = useState('')
    const [searchKeyword, setSearchKeyword] = useState('')
    const [isSearchMode, setIsSearchMode] = useState(false)
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
    const [writeEnabled, setWriteEnabled] = useState(true)
    const [resolvingPath, setResolvingPath] = useState('')
    const uploadInputRef = useRef<HTMLInputElement | null>(null)

    const showDriveError = (message: string) => toast.error(message)
    const showDriveSuccess = (message: string) => toast.success(message)
    const showDriveInfo = (message: string) => toast.info(message)

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

    async function loadDirectory(
        path: string,
        options: { refresh?: boolean; silent?: boolean; page?: number; perPage?: number } = {},
    ) {
        if (!effectivePermissions.view) {
            setLoading(false)
            setItems([])
            setTotalCount(0)
            setPageError('当前权限不允许查看网盘内容。')
            return
        }

        const nextPath = normalizePath(path)
        const nextPage = Math.max(1, options.page || 1)
        const nextPerPage = options.perPage || perPage
        if (!options.silent) {
            setLoading(true)
        }

        try {
            const payload = await requestDriveJson<DriveListPayload>('list', {
                path: nextPath,
                refresh: options.refresh === true,
                page: nextPage,
                perPage: nextPerPage,
            })
            setPageError('')
            setCurrentPath(payload.path)
            setItems(payload.items || [])
            setTotalCount(payload.total || 0)
            setCurrentPage(nextPage)
            setPerPage(nextPerPage)
            setSelectedPaths(new Set())
            setWriteEnabled(payload.write !== false)
            setIsSearchMode(false)
            setSearchKeyword('')
        } catch (error) {
            const message = describeDriveError(error, '加载目录失败')
            setPageError(message)
            showDriveError(message)
        } finally {
            setLoading(false)
        }
    }

    async function runSearch(options: { page?: number; perPage?: number; keyword?: string } = {}) {
        if (!(effectivePermissions.view || effectivePermissions.download)) {
            const message = '当前权限不允许查看网盘内容。'
            setPageError(message)
            showDriveError(message)
            return
        }

        const keyword = (options.keyword ?? searchInput).trim()
        const nextPage = Math.max(1, options.page || 1)
        const nextPerPage = options.perPage || perPage
        if (!keyword) {
            await loadDirectory(currentPath, { silent: false, page: 1, perPage: nextPerPage })
            return
        }

        setSearching(true)
        try {
            const payload = await requestDriveJson<{ items: DriveEntry[]; total: number }>('search', {
                parent: currentPath,
                keywords: keyword,
                page: nextPage,
                perPage: nextPerPage,
            })
            setPageError('')
            setItems(payload.items || [])
            setTotalCount(payload.total || 0)
            setCurrentPage(nextPage)
            setPerPage(nextPerPage)
            setSelectedPaths(new Set())
            setIsSearchMode(true)
            setSearchKeyword(keyword)
        } catch (error) {
            const message = describeDriveError(error, '搜索失败')
            setPageError(message)
            showDriveError(message)
        } finally {
            setSearching(false)
        }
    }

    async function mutate(action: () => Promise<void>, successMessage: string) {
        setBusy(true)
        try {
            await action()
            setPageError('')
            showDriveSuccess(successMessage)
            await loadDirectory(currentPath, { silent: false })
        } catch (error) {
            const message = describeDriveError(error, '操作失败')
            setPageError(message)
            showDriveError(message)
        } finally {
            setBusy(false)
        }
    }

    async function handleCreateFolder() {
        if (!effectivePermissions.mkdir) {
            showDriveError(`当前权限不允许${getPermissionLabel('mkdir')}。`)
            return
        }

        const name = window.prompt('请输入新文件夹名称')
        if (!name) return

        await mutate(async () => {
            await requestDriveJson('mkdir', {
                path: joinPath(currentPath, name),
            })
        }, '文件夹已创建')
    }

    async function handleRename(entry: DriveEntry) {
        if (!effectivePermissions.rename) {
            showDriveError(`当前权限不允许${getPermissionLabel('rename')}。`)
            return
        }

        const nextName = window.prompt('请输入新的名称', entry.name)
        if (!nextName || nextName === entry.name) return

        await mutate(async () => {
            await requestDriveJson('rename', {
                path: entry.path,
                name: nextName,
            })
        }, '名称已更新')
    }

    async function handleDelete(entries: DriveEntry[]) {
        if (!effectivePermissions.remove) {
            showDriveError(`当前权限不允许${getPermissionLabel('remove')}。`)
            return
        }

        if (entries.length === 0) return
        const label = entries.length === 1 ? `“${entries[0].name}”` : `${entries.length} 个项目`
        if (!window.confirm(`确定要删除 ${label} 吗？此操作不可恢复。`)) {
            return
        }

        await mutate(async () => {
            await requestDriveJson('remove', {
                dir: currentPath,
                names: entries.map((entry) => entry.name),
            })
        }, '删除完成')
    }

    async function handleMoveOrCopy(mode: 'move' | 'copy', entries: DriveEntry[]) {
        const permissionKey = mode === 'move' ? 'move' : 'copy'
        if (!effectivePermissions[permissionKey]) {
            showDriveError(`当前权限不允许${getPermissionLabel(permissionKey)}。`)
            return
        }

        if (entries.length === 0) return
        const destination = window.prompt(
            mode === 'move' ? '请输入目标目录路径，例如 /公开/资料' : '请输入复制到的目标目录路径，例如 /备份',
            currentPath,
        )
        if (!destination) return

        await mutate(async () => {
            await requestDriveJson(mode, {
                srcDir: currentPath,
                dstDir: normalizePath(destination),
                names: entries.map((entry) => entry.name),
            })
        }, mode === 'move' ? '移动完成' : '复制完成')
    }

    async function handleUpload(files: FileList | null) {
        if (!effectivePermissions.upload) {
            showDriveError(`当前权限不允许${getPermissionLabel('upload')}。`)
            return
        }

        if (!files || files.length === 0) return

        const formData = new FormData()
        Array.from(files).forEach((file) => {
            formData.append('files', file, file.name)
        })

        setBusy(true)
        const toastId = toast.loading(`正在上传 ${files.length} 个文件...`)

        try {
            const response = await fetch(`${SITE_API_BASE_URL}/api/drive/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                body: formData,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : '上传失败')
            }

            toast.success('上传完成', { id: toastId })
            await loadDirectory(currentPath, { silent: false })
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '上传失败', { id: toastId })
        } finally {
            setBusy(false)
            if (uploadInputRef.current) {
                uploadInputRef.current.value = ''
            }
        }
    }

    async function resolveFileItem(entry: DriveEntry, intent: 'view' | 'download') {
        if (!effectivePermissions.view && !effectivePermissions.download) {
            showDriveError('当前权限不允许查看或下载该文件。')
            return null
        }

        setResolvingPath(entry.path)
        try {
            const payload = await requestDriveJson<DriveItemPayload>('item', {
                path: entry.path,
                intent,
            })
            setPageError('')
            return payload
        } catch (error) {
            const message = describeDriveError(error, '获取文件信息失败')
            setPageError(message)
            showDriveError(message)
            return null
        } finally {
            setResolvingPath('')
        }
    }

    function openItemInPotPlayer(item: DriveItemPayload) {
        const streamUrl = item.rawUrl || item.resolvedUrl
        if (!streamUrl) {
            showDriveError('当前文件没有可用于 PotPlayer 的播放直链。')
            return
        }

        window.location.href = buildPotPlayerUrl(streamUrl)
        window.setTimeout(() => {
            showDriveInfo('已尝试唤起 PotPlayer。若没有自动打开，请确认系统已注册 potplayer:// 协议。')
        }, 250)
    }

    async function copyItemDownloadLink(item: DriveItemPayload) {
        const downloadUrl = item.rawUrl || item.resolvedUrl
        if (!downloadUrl) {
            showDriveError('当前文件没有可复制的下载链接。')
            return
        }

        try {
            await copyTextToClipboard(downloadUrl)
            showDriveInfo(`已复制 ${item.name} 的下载链接。`)
        } catch {
            showDriveError('复制下载链接失败，请检查浏览器剪贴板权限。')
        }
    }

    async function openPreviewModal(entry: DriveEntry, item: DriveItemPayload) {
        const previewUrl = item.rawUrl || item.resolvedUrl || buildDriveFileUrl(entry.path, 'view')
        setPreviewLoading(true)

        try {
            const nextState = await loadDrivePreview(entry, item, previewUrl)
            setPreviewState(nextState)
        } catch (error) {
            const message = describeDriveError(error, '打开预览失败')
            setPageError(message)
            showDriveError(message)
        } finally {
            setPreviewLoading(false)
        }
    }

    async function openFileEntry(entry: DriveEntry) {
        if (!effectivePermissions.view) {
            showDriveError(`当前权限不允许${getPermissionLabel('view')}。`)
            return
        }

        const item = await resolveFileItem(entry, 'view')
        if (!item?.rawUrl) {
            return
        }

        const previewable = Boolean(getPreviewKind(item))
        if (!previewable) {
            if (!effectivePermissions.download) {
                showDriveInfo('该文件类型暂不支持站内预览，且当前也没有下载权限。')
                return
            }

            showDriveInfo('该文件类型暂不支持站内预览，已自动为你切换为下载。')
            triggerExternalUrl(item.resolvedUrl || item.rawUrl, {
                downloadName: item.name || entry.name,
            })
            return
        }

        await openPreviewModal(entry, item)
    }

    async function downloadFileEntry(entry: DriveEntry) {
        if (!effectivePermissions.download) {
            showDriveError(`当前权限不允许${getPermissionLabel('download')}。`)
            return
        }

        const item = await resolveFileItem(entry, 'download')
        if (!item?.rawUrl) {
            return
        }

        showDriveInfo(`正在开始下载 ${item.name || entry.name}...`)
        triggerExternalUrl(item.resolvedUrl || item.rawUrl, {
            downloadName: item.name || entry.name,
        })
    }

    function openEntry(entry: DriveEntry) {
        if (entry.isDir) {
            if (!effectivePermissions.view) {
                showDriveError(`当前权限不允许${getPermissionLabel('view')}。`)
                return
            }
            void loadDirectory(entry.path, { silent: false, page: 1, perPage })
            return
        }

        void openFileEntry(entry)
    }

    function toggleSelected(path: string) {
        const next = new Set(selectedPaths)
        if (next.has(path)) {
            next.delete(path)
        } else {
            next.add(path)
        }
        setSelectedPaths(next)
    }

    function clearSearchMode() {
        setSearchInput('')
        void loadDirectory(currentPath, { silent: false, page: 1, perPage })
    }

    function changePerPage(nextPerPage: number) {
        if (isSearchMode) {
            void runSearch({ page: 1, perPage: nextPerPage, keyword: searchKeyword || searchInput })
            return
        }

        void loadDirectory(currentPath, { silent: false, page: 1, perPage: nextPerPage })
    }

    function changePage(nextPage: number) {
        if (isSearchMode) {
            void runSearch({ page: nextPage, perPage, keyword: searchKeyword || searchInput })
            return
        }

        void loadDirectory(currentPath, { silent: false, page: nextPage, perPage })
    }

    function goToParentDirectory() {
        const parentPath = getParentPath(currentPath)
        void loadDirectory(parentPath || '/', { silent: false, page: 1, perPage })
    }

    function refreshCurrentDirectory() {
        void loadDirectory(currentPath, { refresh: true, silent: false, page: currentPage, perPage })
    }

    useEffect(() => {
        let cancelled = false

        async function bootstrap() {
            try {
                const nextStatus = await requestDriveJson<DriveStatus>('status')
                if (cancelled) return

                setStatus(nextStatus)
                setPageError('')
                if (!nextStatus.configured) {
                    setLoading(false)
                    return
                }
                if (!(configuredPermissions.view && (nextStatus.permissions?.view ?? true))) {
                    setLoading(false)
                    return
                }
                const rootPath = normalizePath(nextStatus.defaultRoot || '/')
                await loadDirectory(rootPath, { silent: false })
            } catch (error) {
                if (!cancelled) {
                    const message = describeDriveError(error, '网盘初始化失败')
                    setPageError(message)
                    showDriveError(message)
                    setLoading(false)
                }
            }
        }

        void bootstrap()
        return () => {
            cancelled = true
        }
    }, [])

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

    useEffect(() => {
        const revokeUrls = previewState?.revokeUrls || []
        return () => {
            for (const url of revokeUrls) {
                URL.revokeObjectURL(url)
            }
        }
    }, [previewState?.revokeUrls])

    const selectedEntries = items.filter((entry) => selectedPaths.has(entry.path))
    const breadcrumbs = splitBreadcrumbs(currentPath)
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
    const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1
    const endIndex = totalCount === 0 ? 0 : Math.min(currentPage * perPage, totalCount)
    const visiblePages = getVisiblePages(currentPage, totalPages)

    return {
        toastTheme,
        status,
        currentPath,
        items,
        totalCount,
        currentPage,
        perPage,
        loading,
        busy,
        previewLoading,
        previewState,
        pageError,
        searching,
        searchInput,
        searchKeyword,
        isSearchMode,
        selectedPaths,
        writeEnabled,
        resolvingPath,
        uploadInputRef,
        effectivePermissions,
        selectedEntries,
        breadcrumbs,
        totalPages,
        startIndex,
        endIndex,
        visiblePages,
        setPreviewState,
        setSearchInput,
        handleUpload,
        downloadFileEntry,
        copyItemDownloadLink,
        openItemInPotPlayer,
        handleCreateFolder,
        runSearch,
        goToParentDirectory,
        refreshCurrentDirectory,
        changePerPage,
        changePage,
        clearSearchMode,
        openEntry,
        toggleSelected,
        handleRename,
        handleMoveOrCopy,
        handleDelete,
        loadDirectory,
    }
}

export type DrivePageController = ReturnType<typeof useDrivePageController>
