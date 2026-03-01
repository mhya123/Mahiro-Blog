import { useCallback } from 'react'
import { readFileAsText } from '@/lib/file-utils'
import { toast } from 'sonner'
import { pushBlog } from '../services/push-blog'
import { deleteBlog } from '../services/delete-blog'
import { useWriteStore } from '../stores/write-store'
import { useAuthStore } from './use-auth'

/** slug 只允许小写字母、数字、连字符、下划线 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9\-_]*$/

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug, originalFileFormat } = useWriteStore()
	const { isAuth, setPrivateKey } = useAuthStore()

	const onChoosePrivateKey = useCallback(
		async (file: File) => {
			const pem = await readFileAsText(file)
			setPrivateKey(pem)
		},
		[setPrivateKey]
	)

	const onPublish = useCallback(async () => {
		if (!form.title?.trim()) {
			toast.warning('⚠️ 请输入文章标题')
			return
		}
		if (!form.slug?.trim()) {
			toast.warning('⚠️ 请输入文章 Slug (URL 路径)')
			return
		}
		if (!SLUG_PATTERN.test(form.slug)) {
			toast.warning('⚠️ Slug 只能包含小写字母、数字、连字符和下划线，且不能以符号开头')
			return
		}
		if (!form.md?.trim()) {
			toast.warning('⚠️ 文章内容不能为空')
			return
		}

		try {
			setLoading(true)
			await pushBlog({
				form,
				cover,
				images,
				mode,
				originalSlug,
				originalFileFormat
			})
		} catch (err: any) {
			console.error(err)
			// error is already toasted in pushBlog
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, originalFileFormat, setLoading])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('❌ 缺少 Slug，无法删除')
			return
		}
		try {
			setLoading(true)
			await deleteBlog(targetSlug)
			toast.success('🗑️ 文章已成功删除', {
				description: '更改已推送至 GitHub，请等待部署完成。'
			})
		} catch (err: any) {
			console.error(err)
			toast.error('❌ 删除失败', {
				description: err?.message
			})
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading])

	return {
		isAuth,
		loading,
		onChoosePrivateKey,
		onPublish,
		onDelete
	}
}
