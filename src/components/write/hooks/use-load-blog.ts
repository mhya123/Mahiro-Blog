import { useEffect, useRef } from 'react'
import { useWriteStore } from '../stores/write-store'
import { toast } from 'sonner'

export function useLoadBlog(slug?: string) {
	const { loadBlogForEdit, loading } = useWriteStore()
	const loadedRef = useRef<string | null>(null)

	useEffect(() => {
		// 避免相同 slug 重复加载（React StrictMode 双次 effect）
		if (!slug || loadedRef.current === slug) return
		loadedRef.current = slug

		loadBlogForEdit(slug).catch(err => {
			console.error('Failed to load blog:', err)
			toast.error('加载博客失败')
			loadedRef.current = null // 允许重试
		})
	}, [slug, loadBlogForEdit])

	return { loading }
}
