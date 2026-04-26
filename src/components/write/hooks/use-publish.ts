import { useCallback } from 'react'
import { readFileAsText } from '@/lib/file-utils'
import { toast } from 'sonner'
import { pushBlog } from '../services/push-blog'
import { deleteBlog } from '../services/delete-blog'
import { useWriteStore } from '../stores/write-store'
import { useAuthStore } from './use-auth'
import { WRITE_DRAFT_STORAGE_KEY } from '../constants'

/** slug 只允许小写字母、数字、连字符、下划线 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9\-_]*$/

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug, originalFileFormat, aiSummaryStatus } = useWriteStore()
	const { isAuth, setPrivateKey } = useAuthStore()

	const onChoosePrivateKey = useCallback(
		async (file: File) => {
			try {
				const pem = await readFileAsText(file)
				if (!pem.includes('BEGIN RSA PRIVATE KEY') && !pem.includes('BEGIN PRIVATE KEY')) {
					throw new Error('无效的私钥文件格式')
				}
				setPrivateKey(pem)
				toast.success('🔑 私钥导入成功', {
					description: '您现在可以进行发布或删除操作了。'
				})
			} catch (err: any) {
				console.error(err)
				toast.error('❌ 私钥导入失败', {
					description: err?.message || '请确保选择正确的 .pem 私钥文件'
				})
			}
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

		if (aiSummaryStatus === 'generating') {
			toast.warning('AI 摘要正在生成中，请等待摘要填充完成后再保存')
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
			if (mode === 'create') {
				try {
					localStorage.removeItem(WRITE_DRAFT_STORAGE_KEY)
				} catch {
					// ignore storage errors
				}
			}
		} catch (err: any) {
			console.error(err)
			// error is already toasted in pushBlog
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, originalFileFormat, aiSummaryStatus, setLoading])

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
