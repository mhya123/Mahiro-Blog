import { toast } from 'sonner'
import { SITE_API_BASE_URL } from '@/consts'
import type { DriveStateContext } from './useDriveState'
import type { DrivePermissions, DriveEntry } from '../types'
import { describeDriveError, requestDriveJson } from '../page-http'
import { getPermissionLabel, joinPath, normalizePath } from '../page-utils'

type MutationOptions = {
    permissions: DrivePermissions
    state: DriveStateContext
    loadDirectory: (path: string, options?: { silent?: boolean }) => Promise<void>
}

export function useDriveMutations({ permissions, state, loadDirectory }: MutationOptions) {
    const showDriveError = (message: string) => toast.error(message)
    const showDriveSuccess = (message: string) => toast.success(message)

    async function mutate(action: () => Promise<void>, successMessage: string) {
        state.setBusy(true)
        try {
            await action()
            state.setPageError('')
            showDriveSuccess(successMessage)
            await loadDirectory(state.currentPath, { silent: false })
        } catch (error) {
            const message = describeDriveError(error, '操作失败')
            state.setPageError(message)
            showDriveError(message)
        } finally {
            state.setBusy(false)
        }
    }

    async function handleCreateFolder() {
        if (!permissions.mkdir) {
            showDriveError(`当前权限不允许${getPermissionLabel('mkdir')}。`)
            return
        }

        const name = window.prompt('请输入新文件夹名称')
        if (!name) return

        await mutate(async () => {
            await requestDriveJson('mkdir', {
                path: joinPath(state.currentPath, name),
            })
        }, '文件夹已创建')
    }

    async function handleRename(entry: DriveEntry) {
        if (!permissions.rename) {
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
        if (!permissions.remove) {
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
                dir: state.currentPath,
                names: entries.map((entry) => entry.name),
            })
        }, '删除完成')
    }

    async function handleMoveOrCopy(mode: 'move' | 'copy', entries: DriveEntry[]) {
        const permissionKey = mode === 'move' ? 'move' : 'copy'
        if (!permissions[permissionKey]) {
            showDriveError(`当前权限不允许${getPermissionLabel(permissionKey)}。`)
            return
        }

        if (entries.length === 0) return
        const destination = window.prompt(
            mode === 'move' ? '请输入目标目录路径，例如 /公开/资料' : '请输入复制到的目标目录路径，例如 /备份',
            state.currentPath,
        )
        if (!destination) return

        await mutate(async () => {
            await requestDriveJson(mode, {
                srcDir: state.currentPath,
                dstDir: normalizePath(destination),
                names: entries.map((entry) => entry.name),
            })
        }, mode === 'move' ? '移动完成' : '复制完成')
    }

    async function handleUpload(files: FileList | null) {
        if (!permissions.upload) {
            showDriveError(`当前权限不允许${getPermissionLabel('upload')}。`)
            return
        }

        if (!files || files.length === 0) return

        const formData = new FormData()
        Array.from(files).forEach((file) => {
            formData.append('files', file, file.name)
        })

        state.setBusy(true)
        const toastId = toast.loading(`正在上传 ${files.length} 个文件...`)

        try {
            const response = await fetch(`${SITE_API_BASE_URL}/api/drive/upload?path=${encodeURIComponent(state.currentPath)}`, {
                method: 'POST',
                body: formData,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : '上传失败')
            }

            toast.success('上传完成', { id: toastId })
            await loadDirectory(state.currentPath, { silent: false })
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '上传失败', { id: toastId })
        } finally {
            state.setBusy(false)
            if (state.uploadInputRef.current) {
                state.uploadInputRef.current.value = ''
            }
        }
    }

    return {
        handleCreateFolder,
        handleRename,
        handleDelete,
        handleMoveOrCopy,
        handleUpload,
    }
}
