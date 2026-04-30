import { useEffect } from 'react'
import { toast } from 'sonner'
import type { DriveStateContext } from './useDriveState'
import type { DrivePermissions, DriveEntry, DriveItemPayload } from '../types'
import { describeDriveError, requestDriveJson } from '../page-http'
import { buildDriveFileUrl, buildPotPlayerUrl, copyTextToClipboard, triggerExternalUrl } from '../page-actions'
import { getPreviewKind } from '../preview/file-types'
import { loadDrivePreview } from '../preview/loaders'
import { getPermissionLabel } from '../page-utils'

type PreviewOptions = {
    permissions: DrivePermissions
    state: DriveStateContext
}

export function useDrivePreview({ permissions, state }: PreviewOptions) {
    const showDriveError = (message: string) => toast.error(message)
    const showDriveInfo = (message: string) => toast.info(message)

    useEffect(() => {
        const revokeUrls = state.previewState?.revokeUrls || []
        return () => {
            for (const url of revokeUrls) {
                URL.revokeObjectURL(url)
            }
        }
    }, [state.previewState?.revokeUrls])

    async function resolveFileItem(entry: DriveEntry, intent: 'view' | 'download') {
        if (!permissions.view && !permissions.download) {
            showDriveError('当前权限不允许查看或下载该文件。')
            return null
        }

        state.setResolvingPath(entry.path)
        try {
            const payload = await requestDriveJson<DriveItemPayload>('item', {
                path: entry.path,
                intent,
            })
            state.setPageError('')
            return payload
        } catch (error) {
            const message = describeDriveError(error, '获取文件信息失败')
            state.setPageError(message)
            showDriveError(message)
            return null
        } finally {
            state.setResolvingPath('')
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
        state.setPreviewLoading(true)

        try {
            const nextState = await loadDrivePreview(entry, item, previewUrl)
            state.setPreviewState(nextState)
        } catch (error) {
            const message = describeDriveError(error, '打开预览失败')
            state.setPageError(message)
            showDriveError(message)
        } finally {
            state.setPreviewLoading(false)
        }
    }

    async function openFileEntry(entry: DriveEntry) {
        if (!permissions.view) {
            showDriveError(`当前权限不允许${getPermissionLabel('view')}。`)
            return
        }

        const item = await resolveFileItem(entry, 'view')
        if (!item?.rawUrl) {
            return
        }

        const previewable = Boolean(getPreviewKind(item))
        if (!previewable) {
            if (!permissions.download) {
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
        if (!permissions.download) {
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

    return {
        openFileEntry,
        downloadFileEntry,
        copyItemDownloadLink,
        openItemInPotPlayer,
    }
}
