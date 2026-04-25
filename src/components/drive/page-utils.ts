import {
    File,
    FileArchive,
    FileAudio2,
    FileCode2,
    FileImage,
    FileText,
    FileVideo2,
    Folder,
} from 'lucide-react'
import type { DriveEntry, DrivePermissions } from './types'

export const DEFAULT_PERMISSIONS: DrivePermissions = {
    upload: false,
    mkdir: false,
    view: true,
    download: true,
    rename: false,
    copy: false,
    move: false,
    remove: false,
}

export const PER_PAGE_OPTIONS = [20, 30, 50, 100, 200, 300]

export function joinPath(base: string, name: string) {
    const cleanBase = base === '/' ? '/' : base.replace(/\/+$/, '')
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
    if (!cleanName) {
        return cleanBase || '/'
    }

    return cleanBase === '/' ? `/${cleanName}` : `${cleanBase}/${cleanName}`
}

export function normalizePath(value: string) {
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

export function getParentPath(path: string) {
    const normalized = normalizePath(path)
    if (normalized === '/') {
        return null
    }

    const segments = normalized.split('/').filter(Boolean)
    segments.pop()
    return segments.length > 0 ? `/${segments.join('/')}` : '/'
}

export function splitBreadcrumbs(path: string) {
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

export function formatTime(value: string) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString('zh-CN', {
        hour12: false,
    })
}

export function getFileIcon(entry: DriveEntry) {
    if (entry.isDir) return Folder
    if (entry.type === 'image') return FileImage
    if (entry.type === 'video') return FileVideo2
    if (entry.type === 'audio') return FileAudio2
    if (entry.type === 'archive') return FileArchive
    if (entry.type === 'pdf' || entry.type === 'text') return FileText
    if (/\.(json|ya?ml|toml|ini|js|ts|tsx|jsx|astro|css|scss|html|md|mdx)$/i.test(entry.name)) return FileCode2
    return File
}

export function getPermissionLabel(key: keyof DrivePermissions) {
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

export function getVisiblePages(currentPage: number, totalPages: number) {
    const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
    return Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((left, right) => left - right)
}

export function parseCsv(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split(',').map((cell) => cell.trim()))
}
