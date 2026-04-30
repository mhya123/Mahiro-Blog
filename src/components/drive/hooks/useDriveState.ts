import { useRef, useState } from 'react'
import type { DriveEntry, DriveStatus } from '../types'
import type { DrivePreviewState } from '../preview/types'

export function useDriveState() {
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

    return {
        toastTheme, setToastTheme,
        status, setStatus,
        currentPath, setCurrentPath,
        items, setItems,
        totalCount, setTotalCount,
        currentPage, setCurrentPage,
        perPage, setPerPage,
        loading, setLoading,
        busy, setBusy,
        previewLoading, setPreviewLoading,
        previewState, setPreviewState,
        pageError, setPageError,
        searching, setSearching,
        searchInput, setSearchInput,
        searchKeyword, setSearchKeyword,
        isSearchMode, setIsSearchMode,
        selectedPaths, setSelectedPaths,
        writeEnabled, setWriteEnabled,
        resolvingPath, setResolvingPath,
        uploadInputRef,
    }
}

export type DriveStateContext = ReturnType<typeof useDriveState>
