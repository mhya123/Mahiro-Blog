import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { usePublish } from '../hooks/use-publish'
import { WRITE_DRAFT_STORAGE_KEY, isDraftFormMeaningful } from '../constants'

export function WriteActions() {
	const { loading, mode, form, originalSlug, updateForm } = useWriteStore()
	const { openPreview } = usePreviewStore()
	const { isAuth, onChoosePrivateKey, onPublish, onDelete } = usePublish()
	const keyInputRef = useRef<HTMLInputElement>(null)
	const mdInputRef = useRef<HTMLInputElement>(null)
	const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null)

	const refreshDraftMeta = useCallback(() => {
		try {
			const raw = localStorage.getItem(WRITE_DRAFT_STORAGE_KEY)
			if (!raw) {
				setLastDraftSavedAt(null)
				return
			}
			const parsed = JSON.parse(raw) as { updatedAt?: number }
			setLastDraftSavedAt(typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : null)
		} catch {
			setLastDraftSavedAt(null)
		}
	}, [])

	useEffect(() => {
		if (mode !== 'create') {
			setLastDraftSavedAt(null)
			return
		}

		const timer = window.setTimeout(refreshDraftMeta, 750)
		return () => window.clearTimeout(timer)
	}, [form, mode, refreshDraftMeta])

	const handleManualSaveDraft = () => {
		if (mode !== 'create') {
			toast.info('编辑模式下不启用草稿缓存')
			return
		}
		if (!isDraftFormMeaningful(form)) {
			toast.warning('当前内容为空，暂无可保存草稿')
			return
		}
		try {
			const updatedAt = Date.now()
			localStorage.setItem(
				WRITE_DRAFT_STORAGE_KEY,
				JSON.stringify({ form, updatedAt }),
			)
			setLastDraftSavedAt(updatedAt)
			toast.success('草稿已手动保存')
		} catch {
			toast.error('草稿保存失败，请检查浏览器存储权限')
		}
	}

	const handleClearDraft = () => {
		if (!window.confirm('确定清空本地草稿吗？此操作不可恢复。')) return
		try {
			localStorage.removeItem(WRITE_DRAFT_STORAGE_KEY)
			setLastDraftSavedAt(null)
			toast.success('本地草稿已清空')
		} catch {
			toast.error('清空草稿失败')
		}
	}

	// Ctrl/Cmd + S → 发布/更新
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault()
				if (!loading && isAuth) {
					onPublish()
				}
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [loading, isAuth, onPublish])

	const handleImportOrPublish = () => {
		if (!isAuth) {
			keyInputRef.current?.click()
		} else {
			const confirmMsg = mode === 'edit'
				? `确定更新《${form.title}》吗？这将直接推送到 GitHub 仓库。`
				: `确定发布《${form.title}》吗？这将直接推送到 GitHub 仓库。`

			if (window.confirm(confirmMsg)) {
				onPublish()
			}
		}
	}

	const handleCancel = () => {
		if (!window.confirm('确定放弃本次修改吗？未保存的内容将丢失。')) {
			return
		}
		if (mode === 'edit' && originalSlug) {
			window.location.href = `/blog/${originalSlug}`
		} else {
			window.location.href = '/'
		}
	}

	const buttonText = isAuth ? (mode === 'edit' ? '更新' : '发布') : '导入密钥'

	const handleDelete = () => {
		if (!isAuth) {
			toast.info('🔑 请先导入私钥以进行操作')
			return
		}
		const confirmMsg = form?.title ? `⚠️ 确定删除《${form.title}》吗？该操作不可恢复。` : '⚠️ 确定删除当前文章吗？该操作不可恢复。'
		if (window.confirm(confirmMsg)) {
			onDelete()
		}
	}

	const handleImportMd = () => {
		mdInputRef.current?.click()
	}

	const handleMdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (form.md && !window.confirm('⚠️ 确定导入 Markdown 文件吗？这将覆盖当前编辑的内容。')) {
			if (e.currentTarget) e.currentTarget.value = ''
			return
		}

		try {
			const { parseFrontmatter } = await import('@/lib/frontmatter')
			const text = await file.text()
			const { data, content } = parseFrontmatter(text)

			// 如果导入的文件有 frontmatter，自动回填元信息
			const updates: Partial<typeof form> = { md: content || text }
			if (data.title) updates.title = data.title
			if (data.description) updates.summary = data.description
			if (data.aiModel) updates.aiModel = data.aiModel
			if (data.tags?.length) updates.tags = data.tags
			if (data.categories?.length) updates.categories = data.categories
			if (data.draft !== undefined) updates.hidden = data.draft

			updateForm(updates)
			toast.success('📄 Markdown 文件导入成功')
		} catch (error) {
			toast.error('❌ 导入失败，请重试')
		} finally {
			if (e.currentTarget) e.currentTarget.value = ''
		}
	}

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await onChoosePrivateKey(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>
			<input ref={mdInputRef} type='file' accept='.md,.mdx,.markdown' className='hidden' onChange={handleMdFileChange} />

			<ul className='absolute top-4 right-6 z-40 flex items-center gap-2 bg-base-100/80 backdrop-blur-xl border border-base-content/10 rounded-2xl px-4 py-2 shadow-lg'>
				{mode === 'edit' && (
					<>
						<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='flex items-center gap-2'>
							<div className='rounded-lg border border-info/30 bg-info/10 px-4 py-2 text-sm text-info font-medium'>编辑模式</div>
						</motion.div>

						<motion.button
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className='btn btn-sm btn-error btn-outline rounded-xl'
							disabled={loading}
							onClick={handleDelete}>
							{loading ? (
								<>
									<span className="loading loading-spinner loading-xs"></span>
									处理中
								</>
							) : '删除'}
						</motion.button>

						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={loading}
							className='btn btn-sm btn-ghost rounded-xl text-base-content'>
							取消
						</motion.button>
					</>
				)}

				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='btn btn-sm btn-ghost rounded-xl text-base-content'
					disabled={loading}
					onClick={handleImportMd}>
					导入 MD
				</motion.button>
				<div className='dropdown dropdown-end'>
					<motion.button
						initial={{ opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						className='btn btn-sm btn-ghost rounded-xl text-base-content'
						disabled={loading || mode !== 'create'}>
						草稿
					</motion.button>
					<div className='dropdown-content z-[60] mt-2 w-64 rounded-xl border border-base-200 bg-base-100 p-3 shadow-xl'>
						<div className='text-xs text-base-content/70 mb-2'>
							最近保存：{lastDraftSavedAt ? new Date(lastDraftSavedAt).toLocaleString('zh-CN') : '暂无'}
						</div>
						<div className='grid grid-cols-2 gap-2'>
							<button type='button' className='btn btn-xs btn-primary' onClick={handleManualSaveDraft}>手动保存</button>
							<button type='button' className='btn btn-xs btn-outline btn-error' onClick={handleClearDraft}>清空草稿</button>
						</div>
					</div>
				</div>
				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='btn btn-sm btn-ghost rounded-xl text-base-content'
					disabled={loading}
					onClick={openPreview}>
					预览
				</motion.button>
				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='btn btn-sm btn-primary rounded-xl px-6 shadow-lg shadow-primary/20'
					disabled={loading}
					onClick={handleImportOrPublish}>
					{loading ? (
						<>
							<span className="loading loading-spinner loading-xs"></span>
							处理中
						</>
					) : buttonText}
				</motion.button>
			</ul>
		</>
	)
}
