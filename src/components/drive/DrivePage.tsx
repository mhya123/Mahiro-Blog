'use client'

import { useEffect, useRef, useState } from 'react'
import {
    ArrowUpRight,
    Copy,
    Download,
    File,
    FileArchive,
    FileAudio2,
    FileCode2,
    FileImage,
    FileText,
    FileVideo2,
    Folder,
    FolderPlus,
    HardDrive,
    LoaderCircle,
    Move,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
    X,
    PencilLine,
    ChevronRight,
    House,
} from 'lucide-react'
import { marked } from 'marked'
import { Toaster, toast } from 'sonner'
import { SITE_API_BASE_URL } from '@/consts'
import type { DriveEntry, DriveItemPayload, DriveListPayload, DrivePermissions, DriveStatus } from './types'
import type { DrivePreviewState } from './preview/types'
import { getPreviewKind } from './preview/file-types'
import { loadDrivePreview } from './preview/loaders'
import { DrivePreviewModal } from './preview/DrivePreviewModal'
import { getDriveFileTypeLabel } from './file-meta'

type DrivePageProps = {
    permissions?: Partial<DrivePermissions>
}

const DEFAULT_PERMISSIONS: DrivePermissions = {
    upload: false,
    mkdir: false,
    view: true,
    download: true,
    rename: false,
    copy: false,
    move: false,
    remove: false,
}

const PER_PAGE_OPTIONS = [20, 30, 50, 100, 200, 300]

function joinPath(base: string, name: string) {
    const cleanBase = base === '/' ? '/' : base.replace(/\/+$/, '')
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
    if (!cleanName) {
        return cleanBase || '/'
    }

    return cleanBase === '/' ? `/${cleanName}` : `${cleanBase}/${cleanName}`
}

function normalizePath(value: string) {
    let next = String(value || '/').trim()
    if (!next) return '/'
    next = next.replace(/\\/g, '/')
    if (!next.startsWith('/')) next = `/${next}`
    next = next.replace(/\/{2,}/g, '/')
    if (next.length > 1 && next.endsWith('/')) {
        next = next.slice(0, -1)
    }
    return next || '/'
}

function getParentPath(path: string) {
    const normalized = normalizePath(path)
    if (normalized === '/') {
        return null
    }

    const segments = normalized.split('/').filter(Boolean)
    segments.pop()
    return segments.length > 0 ? `/${segments.join('/')}` : '/'
}

function splitBreadcrumbs(path: string) {
    const normalized = normalizePath(path)
    if (normalized === '/') {
        return [{ label: '根目录', path: '/' }]
    }

    const segments = normalized.split('/').filter(Boolean)
    return [
        { label: '根目录', path: '/' },
        ...segments.map((segment, index) => ({
            label: segment,
            path: `/${segments.slice(0, index + 1).join('/')}`,
        })),
    ]
}

function formatTime(value: string) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString('zh-CN', {
        hour12: false,
    })
}

function getFileIcon(entry: DriveEntry) {
    if (entry.isDir) return Folder
    if (entry.type === 'image') return FileImage
    if (entry.type === 'video') return FileVideo2
    if (entry.type === 'audio') return FileAudio2
    if (entry.type === 'archive') return FileArchive
    if (entry.type === 'pdf' || entry.type === 'text') return FileText
    if (/\.(json|ya?ml|toml|ini|js|ts|tsx|jsx|astro|css|scss|html|md|mdx)$/i.test(entry.name)) return FileCode2
    return File
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : `Request failed with status ${response.status}`
        const error = new Error(message) as Error & { status?: number; details?: unknown }
        error.status = response.status
        error.details = data?.details
        throw error
    }

    return data as T
}

function describeDriveError(error: unknown, fallback: string) {
    if (error instanceof Error) {
        if ('status' in error && (error as Error & { status?: number }).status === 403) {
            return '当前权限不允许执行这个网盘操作。'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 404) {
            return '目标文件或接口不存在，可能是后端还没部署最新网盘接口，或该文件已经失效。'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 401) {
            return '网盘鉴权失败，请检查后端里的 AList 账号、密码或 Token。'
        }

        return error.message || fallback
    }

    return fallback
}

function getPermissionLabel(key: keyof DrivePermissions) {
    const labels: Record<keyof DrivePermissions, string> = {
        upload: '上传',
        mkdir: '新建文件夹',
        view: '查看',
        download: '下载',
        rename: '重命名',
        copy: '复制',
        move: '移动',
        remove: '删除',
    }

    return labels[key]
}

function getVisiblePages(currentPage: number, totalPages: number) {
    const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
    return Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((left, right) => left - right)
}

function parseCsv(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split(',').map((cell) => cell.trim()))
}

export default function DrivePage({ permissions }: DrivePageProps) {
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

    function showDriveError(message: string) {
        toast.error(message)
    }

    function showDriveSuccess(message: string) {
        toast.success(message)
    }

    function showDriveInfo(message: string) {
        toast.info(message)
    }

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

    useEffect(() => {
        let cancelled = false

        async function bootstrap() {
            try {
                const nextStatus = await requestJson<DriveStatus>(`${SITE_API_BASE_URL}/api/drive/status`)
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

        bootstrap()
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
            const payload = await requestJson<DriveListPayload>(
                `${SITE_API_BASE_URL}/api/drive/list?path=${encodeURIComponent(nextPath)}&refresh=${options.refresh ? 'true' : 'false'}&page=${nextPage}&perPage=${nextPerPage}`,
            )
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
            setPageError('当前权限不允许查看网盘内容。')
            showDriveError('当前权限不允许查看网盘内容。')
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
            const payload = await requestJson<{ items: DriveEntry[]; total: number }>(
                `${SITE_API_BASE_URL}/api/drive/search`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        parent: currentPath,
                        keywords: keyword,
                        page: nextPage,
                        perPage: nextPerPage,
                    }),
                },
            )
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
            await requestJson(`${SITE_API_BASE_URL}/api/drive/mkdir`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: joinPath(currentPath, name),
                }),
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
            await requestJson(`${SITE_API_BASE_URL}/api/drive/rename`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: entry.path,
                    name: nextName,
                }),
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
            await requestJson(`${SITE_API_BASE_URL}/api/drive/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dir: currentPath,
                    names: entries.map((entry) => entry.name),
                }),
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
            mode === 'move' ? '请输入目标目录路径（例如 /公开/资料）' : '请输入复制到的目标目录路径（例如 /备份）',
            currentPath,
        )
        if (!destination) return

        await mutate(async () => {
            await requestJson(`${SITE_API_BASE_URL}/api/drive/${mode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    srcDir: currentPath,
                    dstDir: normalizePath(destination),
                    names: entries.map((entry) => entry.name),
                }),
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
            const payload = await requestJson<DriveItemPayload>(
                `${SITE_API_BASE_URL}/api/drive/item?path=${encodeURIComponent(entry.path)}&intent=${intent}`,
            )
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

    function triggerExternalUrl(url: string, options: { downloadName?: string; newTab?: boolean } = {}) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.rel = 'noopener noreferrer'
        if (options.newTab) {
            anchor.target = '_blank'
        }
        if (options.downloadName) {
            anchor.download = options.downloadName
        }
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
    }

    async function copyTextToClipboard(text: string) {
        const value = String(text || '').trim()
        if (!value) {
            throw new Error('empty clipboard text')
        }

        if (navigator.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(value)
            return
        }

        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.pointerEvents = 'none'
        document.body.appendChild(textarea)
        textarea.select()
        textarea.setSelectionRange(0, value.length)

        const succeeded = document.execCommand('copy')
        textarea.remove()

        if (!succeeded) {
            throw new Error('copy command failed')
        }
    }

    function buildPotPlayerUrl(url: string) {
        return `potplayer://${String(url || '').trim()}`
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

    function buildDriveFileUrl(path: string, intent: 'view' | 'download') {
        return `${SITE_API_BASE_URL}/api/drive/raw?path=${encodeURIComponent(path)}&intent=${intent}`
    }

    async function openPreviewModalLegacy(entry: DriveEntry, item: DriveItemPayload) {
        const previewUrl = buildDriveFileUrl(entry.path, 'view')
        const previewKind = getPreviewKind(item)
        setPreviewLoading(true)

        try {
            if (previewKind === 'office') {
                setPreviewState({
                    entry,
                    item,
                    kind: 'unsupported',
                    url: '',
                    message: '当前站内预览器暂不支持 Office 文档，请先下载后查看。',
                })
                return
            }

            if (previewKind === 'image' || previewKind === 'video' || previewKind === 'audio' || previewKind === 'pdf') {
                const response = await fetch(previewUrl)
                if (!response.ok) {
                    throw new Error(`Preview request failed: ${response.status}`)
                }

                const blob = await response.blob()
                const objectUrl = URL.createObjectURL(blob)
                setPreviewState({
                    entry,
                    item,
                    kind: previewKind,
                    url: objectUrl,
                    revokeUrl: objectUrl,
                })
                return
            }

            if (previewKind === 'text' || previewKind === 'markdown' || previewKind === 'json' || previewKind === 'csv' || previewKind === 'html') {
                const response = await fetch(previewUrl)
                if (!response.ok) {
                    throw new Error(`Preview request failed: ${response.status}`)
                }

                const textContent = await response.text()
                const nextState: DrivePreviewState = {
                    entry,
                    item,
                    kind: previewKind || 'text',
                    url: previewUrl,
                    textContent,
                }

                if (previewKind === 'markdown') {
                    nextState.htmlContent = await marked.parse(textContent)
                } else if (previewKind === 'json') {
                    try {
                        nextState.textContent = JSON.stringify(JSON.parse(textContent), null, 2)
                    } catch {
                        nextState.textContent = textContent
                    }
                } else if (previewKind === 'csv') {
                    nextState.csvRows = parseCsv(textContent)
                } else if (previewKind === 'html') {
                    nextState.htmlContent = textContent
                }

                setPreviewState({
                    ...nextState,
                })
                return
            }

            setPreviewState({
                entry,
                item,
                kind: 'unsupported',
                url: '',
                message: '该文件类型暂不支持站内预览，请使用下载。',
            })
        } catch (error) {
            const message = describeDriveError(error, '打开预览失败')
            setPageError(message)
            showDriveError(message)
        } finally {
            setPreviewLoading(false)
        }
    }

    async function openPreviewModal(entry: DriveEntry, item: DriveItemPayload) {
        const previewUrl = buildDriveFileUrl(entry.path, 'view')
        setPreviewLoading(true)

        try {
            const nextState = await loadDrivePreview(entry, item, previewUrl)
            setPreviewState(nextState)
        } catch (error) {
            const message = describeDriveError(error, '鎵撳紑棰勮澶辫触')
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

        showDriveInfo(`正在开始下载 ${item.name || entry.name} ...`)
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

    const selectedEntries = items.filter((entry) => selectedPaths.has(entry.path))
    const breadcrumbs = splitBreadcrumbs(currentPath)
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
    const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1
    const endIndex = totalCount === 0 ? 0 : Math.min(currentPage * perPage, totalCount)
    const visiblePages = getVisiblePages(currentPage, totalPages)
    const legacyPreviewState = previewState as DrivePreviewState | null
    const showLegacyPreview = false as boolean
    void openPreviewModalLegacy

    return (
        <>
            <Toaster
                richColors
                theme={toastTheme}
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

            <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    void handleUpload(event.target.files)
                }}
            />

            {previewState && (
                <DrivePreviewModal
                    previewState={previewState}
                    onClose={() => setPreviewState(null)}
                    onDownload={() => {
                        void downloadFileEntry(previewState.entry)
                    }}
                    onCopyDownloadLink={() => {
                        void copyItemDownloadLink(previewState.item)
                    }}
                    onOpenInPotPlayer={() => {
                        openItemInPotPlayer(previewState.item)
                    }}
                />
            )}

            {showLegacyPreview && (() => { const previewState = legacyPreviewState!; return (
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
                    onClick={() => setPreviewState(null)}
                >
                    <div
                        className="flex h-[min(88vh,960px)] w-[min(96vw,1200px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-2xl"
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
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm rounded-full"
                                    onClick={() => {
                                        void downloadFileEntry(previewState.entry)
                                    }}
                                >
                                    <Download className="h-4 w-4" />
                                    下载
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm btn-circle"
                                    onClick={() => setPreviewState(null)}
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
                                <div className="flex h-full items-center justify-center p-4">
                                    <video
                                        src={previewState.url}
                                        controls
                                        className="max-h-full max-w-full rounded-2xl bg-black shadow-xl"
                                    />
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

                            {previewState.kind === 'html' && (
                                <iframe
                                    srcDoc={previewState.htmlContent || ''}
                                    sandbox="allow-same-origin"
                                    title={previewState.item.name}
                                    className="h-full w-full border-0 bg-white"
                                />
                            )}

                            {previewState.kind === 'markdown' && (
                                <div className="h-full overflow-auto p-6">
                                    <article
                                        className="prose prose-sm sm:prose lg:prose-lg max-w-none rounded-2xl bg-base-100 p-6 shadow-inner"
                                        dangerouslySetInnerHTML={{ __html: previewState.htmlContent || '' }}
                                    />
                                </div>
                            )}

                            {previewState.kind === 'csv' && (
                                <div className="h-full overflow-auto p-5">
                                    <div className="overflow-x-auto rounded-2xl bg-base-100 shadow-inner">
                                        <table className="table table-zebra table-pin-rows">
                                            <tbody>
                                                {(previewState.csvRows || []).map((row: string[], rowIndex: number) => (
                                                    <tr key={`${previewState.item.path}-${rowIndex}`}>
                                                        {row.map((cell: string, cellIndex: number) => (
                                                            <td key={`${rowIndex}-${cellIndex}`} className="whitespace-pre-wrap break-words">
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {(previewState.kind === 'text' || previewState.kind === 'json') && (
                                <div className="h-full overflow-auto p-5">
                                    <pre className="min-h-full whitespace-pre-wrap break-words rounded-2xl bg-base-100 p-5 font-mono text-sm leading-7 text-base-content shadow-inner">
                                        {previewState.textContent || '暂无可显示文本内容'}
                                    </pre>
                                </div>
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
                                    <button
                                        type="button"
                                        className="btn btn-primary rounded-full"
                                        onClick={() => {
                                            void downloadFileEntry(previewState.entry)
                                        }}
                                    >
                                        <Download className="h-4 w-4" />
                                        下载文件
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) })()}

            {previewLoading && !previewState && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 backdrop-blur-sm">
                    <div className="rounded-3xl border border-white/10 bg-base-100/95 px-6 py-5 shadow-2xl">
                        <div className="flex items-center gap-3 text-base-content/75">
                            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                            正在打开预览...
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-5 shadow-2xl shadow-primary/5 backdrop-blur-xl md:p-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                                <HardDrive className="h-4 w-4" />
                                站内网盘
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-base-content md:text-4xl">
                                    Mahiro Drive
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-base-content/70 md:text-base">
                                    Mahiro 网盘 - 本站不对任何文件的安全性做保证，请在下载或运行前自行核实，风险自担。
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-3xl border border-success/20 bg-success/10 p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-success">
                                    <ShieldCheck className="h-4 w-4" />
                                    连接状态
                                </div>
                                <div className="mt-2 text-lg font-bold text-base-content">
                                    {status?.connected ? '已连接' : status?.configured ? '待检查' : '未配置'}
                                </div>
                                <div className="mt-1 text-xs text-base-content/60">
                                    {status?.baseHost || '等待后端响应'}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                                    <House className="h-4 w-4" />
                                    当前目录
                                </div>
                                <div className="mt-2 break-all text-lg font-bold text-base-content">
                                    {currentPath}
                                </div>
                                <div className="mt-1 text-xs text-base-content/60">
                                    {items.length} 个项目
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {Object.entries(effectivePermissions).map(([key, allowed]) => (
                            <span
                                key={key}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${
                                    allowed
                                        ? 'border-success/25 bg-success/15 text-base-content'
                                        : 'border-base-300/70 bg-base-200/85 text-base-content/55'
                                }`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        allowed ? 'bg-success' : 'bg-base-content/25'
                                    }`}
                                    aria-hidden="true"
                                />
                                {getPermissionLabel(key as keyof DrivePermissions)}
                            </span>
                        ))}
                    </div>

                    {!status?.configured && (
                        <div className="mt-5 rounded-3xl border border-warning/20 bg-warning/10 p-4 text-sm leading-7 text-base-content/80">
                            当前后端还没有配置 AList。请在 `server/.env` 中补上 `ALIST_BASE_URL`、`ALIST_USERNAME` 和 `ALIST_PASSWORD`。
                        </div>
                    )}

                    {status?.error && (
                        <div className="mt-5 rounded-3xl border border-error/20 bg-error/10 p-4 text-sm leading-7 text-base-content/80">
                            最近一次连接检查失败：{status.error}
                        </div>
                    )}

                    {!effectivePermissions.view && status?.configured && (
                        <div className="mt-5 rounded-3xl border border-warning/20 bg-warning/10 p-4 text-sm leading-7 text-base-content/80">
                            当前权限不允许查看网盘内容。你仍然可以按配置保留其它操作权限，但通常建议至少开启 `view`。
                        </div>
                    )}
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-4 shadow-2xl shadow-base-300/20 backdrop-blur-xl md:p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            {breadcrumbs.map((crumb, index) => (
                                <button
                                    key={crumb.path}
                                    type="button"
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition ${
                                        crumb.path === currentPath
                                            ? 'bg-primary text-primary-content'
                                            : 'bg-base-200/80 text-base-content/70 hover:bg-primary/10 hover:text-primary'
                                    }`}
                                    onClick={() => {
                                        void loadDirectory(crumb.path, { silent: false })
                                    }}
                                >
                                    {index === 0 ? <House className="h-4 w-4" /> : null}
                                    <span>{crumb.label}</span>
                                    {index < breadcrumbs.length - 1 ? <ChevronRight className="h-4 w-4 opacity-60" /> : null}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-1 items-center gap-2 rounded-[1.5rem] border border-base-300/60 bg-base-200/40 px-4 py-3">
                                <Search className="h-4 w-4 text-base-content/50" />
                                <input
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            void runSearch({ page: 1 })
                                        }
                                    }}
                                    className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
                                    placeholder="搜索当前目录中的文件和文件夹"
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm rounded-full"
                                    disabled={loading || searching || busy || !status?.configured}
                                    onClick={() => {
                                        void runSearch({ page: 1 })
                                    }}
                                >
                                    {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '搜索'}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="btn btn-ghost rounded-full"
                                    disabled={loading || busy || currentPath === '/' || !status?.configured || !effectivePermissions.view}
                                    onClick={() => {
                                        const parentPath = getParentPath(currentPath)
                                        void loadDirectory(parentPath || '/', { silent: false, page: 1, perPage })
                                    }}
                                >
                                    <ChevronRight className="h-4 w-4 rotate-180" />
                                    上一级
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost rounded-full"
                                    disabled={loading || busy || !status?.configured || !effectivePermissions.view}
                                    onClick={() => {
                                        void loadDirectory(currentPath, { refresh: true, silent: false, page: currentPage, perPage })
                                    }}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    刷新
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary rounded-full"
                                    disabled={loading || busy || !writeEnabled || !status?.configured || !effectivePermissions.mkdir}
                                    onClick={() => {
                                        void handleCreateFolder()
                                    }}
                                >
                                    <FolderPlus className="h-4 w-4" />
                                    新建文件夹
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-accent rounded-full"
                                    disabled={loading || busy || !writeEnabled || !status?.configured || !effectivePermissions.upload}
                                    onClick={() => uploadInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4" />
                                    上传
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-base-300/50 bg-base-200/25 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm text-base-content/70">
                                {totalCount > 0
                                    ? `当前显示 ${startIndex}-${endIndex} / 共 ${totalCount} 项`
                                    : '当前没有可显示的数据'}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <label className="flex items-center gap-2 text-sm text-base-content/70">
                                    <span>每页</span>
                                    <select
                                        value={perPage}
                                        className="select select-sm select-bordered rounded-full"
                                        onChange={(event) => {
                                            const nextPerPage = Number(event.target.value) || 20
                                            if (isSearchMode) {
                                                void runSearch({ page: 1, perPage: nextPerPage, keyword: searchKeyword || searchInput })
                                                return
                                            }
                                            void loadDirectory(currentPath, { silent: false, page: 1, perPage: nextPerPage })
                                        }}
                                    >
                                        {PER_PAGE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                    <span>条</span>
                                </label>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={loading || searching || currentPage <= 1}
                                        onClick={() => {
                                            const nextPage = currentPage - 1
                                            if (isSearchMode) {
                                                void runSearch({ page: nextPage, perPage, keyword: searchKeyword || searchInput })
                                                return
                                            }
                                            void loadDirectory(currentPath, { silent: false, page: nextPage, perPage })
                                        }}
                                    >
                                        上一页
                                    </button>

                                    {visiblePages.map((page) => (
                                        <button
                                            key={page}
                                            type="button"
                                            className={`btn btn-sm rounded-full ${page === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                                            disabled={loading || searching || page === currentPage}
                                            onClick={() => {
                                                if (isSearchMode) {
                                                    void runSearch({ page, perPage, keyword: searchKeyword || searchInput })
                                                    return
                                                }
                                                void loadDirectory(currentPath, { silent: false, page, perPage })
                                            }}
                                        >
                                            {page}
                                        </button>
                                    ))}

                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={loading || searching || currentPage >= totalPages}
                                        onClick={() => {
                                            const nextPage = currentPage + 1
                                            if (isSearchMode) {
                                                void runSearch({ page: nextPage, perPage, keyword: searchKeyword || searchInput })
                                                return
                                            }
                                            void loadDirectory(currentPath, { silent: false, page: nextPage, perPage })
                                        }}
                                    >
                                        下一页
                                    </button>
                                </div>
                            </div>
                        </div>

                        {pageError && (
                            <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm leading-7 text-base-content/80">
                                {pageError}
                            </div>
                        )}

                        {isSearchMode && (
                            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-base-content/80">
                                搜索结果：当前目录下匹配 “{searchKeyword}” 的项目共 {items.length} 个。
                                <button
                                    type="button"
                                    className="ml-3 font-semibold text-primary"
                                    onClick={() => {
                                        setSearchInput('')
                                        void loadDirectory(currentPath, { silent: false, page: 1, perPage })
                                    }}
                                >
                                    返回目录视图
                                </button>
                            </div>
                        )}

                        {selectedEntries.length > 0 && (
                            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-primary/20 bg-primary/10 p-4 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm font-semibold text-base-content">
                                    已选择 {selectedEntries.length} 个项目
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-full"
                                        disabled={busy || !effectivePermissions.move}
                                        onClick={() => {
                                            void handleMoveOrCopy('move', selectedEntries)
                                        }}
                                    >
                                        <Move className="h-4 w-4" />
                                        批量移动
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-full"
                                        disabled={busy || !effectivePermissions.copy}
                                        onClick={() => {
                                            void handleMoveOrCopy('copy', selectedEntries)
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                        批量复制
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-error btn-sm rounded-full"
                                        disabled={busy || !effectivePermissions.remove}
                                        onClick={() => {
                                            void handleDelete(selectedEntries)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        批量删除
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-3 shadow-2xl shadow-base-300/20 backdrop-blur-xl md:p-4">
                    {loading ? (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-base-content/60">
                            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                            <div className="text-sm">正在加载网盘内容...</div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center text-base-content/60">
                            <Folder className="h-10 w-10 text-base-content/45" />
                            <div className="text-lg font-bold">{effectivePermissions.view ? '这个目录现在是空的' : '当前无可显示内容'}</div>
                            <div className="max-w-md text-sm leading-7">
                                {effectivePermissions.view
                                    ? '你可以上传文件、创建文件夹，或者切换到其他目录继续查看。'
                                    : '当前权限未开启查看能力，所以目录内容不会在页面中展示。'}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((entry) => {
                                const Icon = getFileIcon(entry)
                                const active = selectedPaths.has(entry.path)
                                const isResolvingCurrent = resolvingPath === entry.path

                                return (
                                    <div
                                        key={entry.path}
                                        className={`grid gap-3 rounded-[1.5rem] border p-4 transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center ${
                                            active
                                                ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10'
                                                : 'border-base-300/50 bg-base-200/30 hover:border-primary/25 hover:bg-base-200/50'
                                        }`}
                                    >
                                        <label className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-primary checkbox-sm"
                                                checked={active}
                                                onChange={() => toggleSelected(entry.path)}
                                            />
                                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                                entry.isDir
                                                    ? 'border-base-300/80 bg-base-200/85 text-base-content/72'
                                                    : 'border-primary/10 bg-primary/10 text-primary'
                                            }`}>
                                                <Icon className="h-6 w-6" />
                                            </div>
                                        </label>

                                        <button
                                            type="button"
                                            className="min-w-0 text-left"
                                            onClick={() => openEntry(entry)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="truncate text-base font-bold text-base-content md:text-lg">
                                                    {entry.name}
                                                </div>
                                                {entry.isDir ? (
                                                    <span className="rounded-full border border-base-300/80 bg-base-200/85 px-2 py-1 text-[11px] font-bold text-base-content/68">
                                                        文件夹
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                                                        {getDriveFileTypeLabel(entry)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-base-content/60 md:text-sm">
                                                <span>大小：{entry.sizeLabel}</span>
                                                <span>修改：{formatTime(entry.modified)}</span>
                                                {entry.provider ? <span>存储：{entry.provider}</span> : null}
                                                <span className="break-all">路径：{entry.path}</span>
                                            </div>
                                        </button>

                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm rounded-full"
                                                disabled={isResolvingCurrent || (entry.isDir ? !effectivePermissions.view : !effectivePermissions.view)}
                                                onClick={() => openEntry(entry)}
                                            >
                                                {isResolvingCurrent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : entry.isDir ? <ArrowUpRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                                {entry.isDir ? '打开' : '查看'}
                                            </button>
                                            {!entry.isDir && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm rounded-full"
                                                    disabled={isResolvingCurrent || !effectivePermissions.download}
                                                    onClick={() => {
                                                        void downloadFileEntry(entry)
                                                    }}
                                                >
                                                    {isResolvingCurrent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                    下载
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm rounded-full"
                                                disabled={busy || !writeEnabled || !effectivePermissions.rename}
                                                onClick={() => {
                                                    void handleRename(entry)
                                                }}
                                            >
                                                <PencilLine className="h-4 w-4" />
                                                重命名
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm rounded-full"
                                                disabled={busy || !writeEnabled || !effectivePermissions.copy}
                                                onClick={() => {
                                                    void handleMoveOrCopy('copy', [entry])
                                                }}
                                            >
                                                <Copy className="h-4 w-4" />
                                                复制
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm rounded-full"
                                                disabled={busy || !writeEnabled || !effectivePermissions.move}
                                                onClick={() => {
                                                    void handleMoveOrCopy('move', [entry])
                                                }}
                                            >
                                                <Move className="h-4 w-4" />
                                                移动
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-error btn-outline btn-sm rounded-full"
                                                disabled={busy || !writeEnabled || !effectivePermissions.remove}
                                                onClick={() => {
                                                    void handleDelete([entry])
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>
        </>
    )
}
