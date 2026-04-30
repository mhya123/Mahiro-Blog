import { toast } from 'sonner'
import type { DriveStateContext } from './useDriveState'
import type { DriveListPayload, DrivePermissions, DriveEntry } from '../types'
import { describeDriveError, requestDriveJson } from '../page-http'
import { getParentPath, normalizePath } from '../page-utils'

type NavigationOptions = {
    permissions: DrivePermissions
    state: DriveStateContext
}

export function useDriveNavigation({ permissions, state }: NavigationOptions) {
    const showDriveError = (message: string) => toast.error(message)

    async function loadDirectory(
        path: string,
        options: { refresh?: boolean; silent?: boolean; page?: number; perPage?: number; isPopState?: boolean } = {},
    ) {
        if (!permissions.view) {
            state.setLoading(false)
            state.setItems([])
            state.setTotalCount(0)
            state.setPageError('当前权限不允许查看网盘内容。')
            return
        }

        const nextPath = normalizePath(path)
        const nextPage = Math.max(1, options.page || 1)
        const nextPerPage = options.perPage || state.perPage
        
        if (!options.silent) {
            state.setLoading(true)
        }

        try {
            const payload = await requestDriveJson<DriveListPayload>('list', {
                path: nextPath,
                refresh: options.refresh === true,
                page: nextPage,
                perPage: nextPerPage,
            })
            state.setPageError('')
            
            state.setCurrentPath(payload.path)
            state.setItems(payload.items || [])
            state.setTotalCount(payload.total || 0)
            state.setCurrentPage(nextPage)
            state.setPerPage(nextPerPage)
            state.setSelectedPaths(new Set())
            state.setWriteEnabled(payload.write !== false)
            state.setIsSearchMode(false)
            state.setSearchKeyword('')

            if (typeof window !== 'undefined' && !options.isPopState) {
                const url = new URL(window.location.href)
                const currentUrlDir = url.searchParams.get('dir')
                if (currentUrlDir !== payload.path) {
                    if (payload.path === '/') {
                        url.searchParams.delete('dir')
                    } else {
                        url.searchParams.set('dir', payload.path)
                    }
                    window.history.pushState({ path: payload.path }, '', url)
                }
            }
        } catch (error) {
            const message = describeDriveError(error, '加载目录失败')
            state.setPageError(message)
            showDriveError(message)
        } finally {
            state.setLoading(false)
        }
    }

    async function runSearch(options: { page?: number; perPage?: number; keyword?: string } = {}) {
        if (!(permissions.view || permissions.download)) {
            const message = '当前权限不允许查看网盘内容。'
            state.setPageError(message)
            showDriveError(message)
            return
        }

        const keyword = (options.keyword ?? state.searchInput).trim()
        const nextPage = Math.max(1, options.page || 1)
        const nextPerPage = options.perPage || state.perPage
        if (!keyword) {
            await loadDirectory(state.currentPath, { silent: false, page: 1, perPage: nextPerPage })
            return
        }

        state.setSearching(true)
        try {
            const payload = await requestDriveJson<{ items: DriveEntry[]; total: number }>('search', {
                parent: state.currentPath,
                keywords: keyword,
                page: nextPage,
                perPage: nextPerPage,
            })
            state.setPageError('')
            
            state.setItems(payload.items || [])
            state.setTotalCount(payload.total || 0)
            state.setCurrentPage(nextPage)
            state.setPerPage(nextPerPage)
            state.setSelectedPaths(new Set())
            state.setIsSearchMode(true)
            state.setSearchKeyword(keyword)
        } catch (error) {
            const message = describeDriveError(error, '搜索失败')
            state.setPageError(message)
            showDriveError(message)
        } finally {
            state.setSearching(false)
        }
    }

    function changePerPage(nextPerPage: number) {
        if (state.isSearchMode) {
            void runSearch({ page: 1, perPage: nextPerPage, keyword: state.searchKeyword || state.searchInput })
            return
        }
        void loadDirectory(state.currentPath, { silent: false, page: 1, perPage: nextPerPage })
    }

    function changePage(nextPage: number) {
        if (state.isSearchMode) {
            void runSearch({ page: nextPage, perPage: state.perPage, keyword: state.searchKeyword || state.searchInput })
            return
        }
        void loadDirectory(state.currentPath, { silent: false, page: nextPage, perPage: state.perPage })
    }

    function goToParentDirectory() {
        const parentPath = getParentPath(state.currentPath)
        void loadDirectory(parentPath || '/', { silent: false, page: 1, perPage: state.perPage })
    }

    function refreshCurrentDirectory() {
        void loadDirectory(state.currentPath, { refresh: true, silent: false, page: state.currentPage, perPage: state.perPage })
    }

    function clearSearchMode() {
        state.setSearchInput('')
        void loadDirectory(state.currentPath, { silent: false, page: 1, perPage: state.perPage })
    }

    return {
        loadDirectory,
        runSearch,
        changePerPage,
        changePage,
        goToParentDirectory,
        refreshCurrentDirectory,
        clearSearchMode,
    }
}
