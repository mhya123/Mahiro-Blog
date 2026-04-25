import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AiModelDefinition } from '@/lib/ai-models'
import { secureApiRequest } from '@/lib/secure-api'
import { useWriteStore } from '../../stores/write-store'
import { TagInput } from '../ui/tag-input'
import { CustomSelect } from '../ui/custom-select'

type MetaSectionProps = {
	delay?: number
	categories?: string[]
	aiModels?: AiModelDefinition[]
}

export function MetaSection({ delay = 0, categories = [], aiModels = [] }: MetaSectionProps) {
	const { form, updateForm } = useWriteStore()
	const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
	const [isCustomCategory, setIsCustomCategory] = useState(() => {
		if (form.categories.length === 0) return false
		return form.categories.length > 1 || (form.categories.length === 1 && !categories.includes(form.categories[0]))
	})

	const categoryOptions = [
		...categories.map((category) => ({ value: category, label: category })),
		{ value: '__custom__', label: '+ 自定义 / 多选...' }
	]

	const aiModelOptions = [
		{ value: '', label: '不启用 AI 摘要' },
		...aiModels.map((model) => ({
			value: model.id,
			label: `${model.name} · ${model.brand}`
		}))
	]

	const handleGenerateSummary = async () => {
		if (!form.aiModel) {
			toast.info('请先选择 AI 模型')
			return
		}
		if (!form.title.trim()) {
			toast.info('请先填写文章标题')
			return
		}
		if (!form.md.trim()) {
			toast.info('请先填写文章内容')
			return
		}

		try {
			setIsGeneratingSummary(true)
			const payload = await secureApiRequest<{
				summary?: string
				model?: string
				modelName?: string
			}>('/api/ai/secure', {
				action: 'summary',
				payload: {
					title: form.title,
					content: form.md,
					summary: form.summary,
					aiModel: form.aiModel
				}
			})
			if (!payload?.summary || typeof payload.summary !== 'string') {
				throw new Error('AI summary API did not return a valid summary')
			}
			/*
			const response = await fetch(`${SITE_API_BASE_URL}/api/ai/plaintext-summary-legacy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: form.title,
					content: form.md,
					summary: form.summary,
					aiModel: form.aiModel
				})
			})

			const payload = await response.json().catch(() => ({}))
			if (!response.ok) {
				throw new Error(payload?.error || payload?.message || '生成摘要失败')
			}
			if (!payload?.summary || typeof payload.summary !== 'string') {
				throw new Error('接口未返回有效摘要')
			}

			*/
			updateForm({ summary: payload.summary })
			toast.success(`摘要已由 ${payload.modelName || payload.model || form.aiModel} 生成`)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '生成摘要失败')
		} finally {
			setIsGeneratingSummary(false)
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay }}
			className='card bg-base-100 border border-base-200 shadow-sm p-4 relative'
		>
			<h2 className='text-sm font-bold text-primary'>元信息</h2>

			<div className='mt-3 space-y-3'>
				<textarea
					placeholder='为这篇文章写一段简短摘要'
					rows={3}
					className='textarea textarea-bordered w-full bg-base-100 focus:textarea-primary resize-none text-sm'
					value={form.summary}
					onChange={e => updateForm({ summary: e.target.value })}
				/>

				<div className='space-y-2'>
					<div className='text-xs font-medium text-base-content/70'>AI 摘要模型</div>
					<CustomSelect
						value={form.aiModel || ''}
						onChange={value => updateForm({ aiModel: value })}
						options={aiModelOptions}
						placeholder='选择用于文章摘要的 AI 模型'
					/>
					<button
						type='button'
						className='btn btn-sm btn-outline btn-primary w-full'
						onClick={handleGenerateSummary}
						disabled={isGeneratingSummary || !form.aiModel}
					>
						{isGeneratingSummary ? (
							<>
								<span className='loading loading-spinner loading-xs'></span>
								生成中
							</>
						) : form.summary ? '重新生成摘要' : '生成摘要'}
					</button>
					<p className='text-xs text-base-content/50'>
						未选择模型时，发布允许继续，但 CI 会跳过这篇文章的 AI 摘要生成。
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<input
						type='checkbox'
						id='pin-check'
						checked={!!form.badge}
						onChange={e => updateForm({ badge: e.target.checked ? 'Pin' : '' })}
						className='toggle toggle-primary toggle-sm'
					/>
					<label htmlFor='pin-check' className='cursor-pointer text-sm text-base-content/80 select-none flex items-center gap-1.5'>
						置顶文章
					</label>
				</div>

				<div className='text-xs font-medium text-base-content/70'>文件格式</div>
				<CustomSelect
					value={form.fileFormat}
					onChange={value => updateForm({ fileFormat: value as 'md' | 'mdx' })}
					options={[
						{ value: 'md', label: 'Markdown (.md)' },
						{ value: 'mdx', label: 'MDX (.mdx)' }
					]}
					placeholder='选择文件格式'
				/>

				<div className='text-xs font-medium text-base-content/70'>标签</div>
				<TagInput tags={form.tags} onChange={tags => updateForm({ tags })} />

				<div className='text-xs font-medium text-base-content/70'>分类</div>
				{categories.length > 0 && !isCustomCategory ? (
					<CustomSelect
						value={categories.includes(form.categories[0]) ? form.categories[0] : ''}
						onChange={value => {
							if (value === '__custom__') {
								setIsCustomCategory(true)
							} else {
								updateForm({ categories: value ? [value] : [] })
							}
						}}
						options={categoryOptions}
						placeholder='选择分类...'
					/>
				) : (
					<div className='space-y-1'>
						<TagInput tags={form.categories} onChange={nextCategories => updateForm({ categories: nextCategories })} />
						{categories.length > 0 && (
							<button
								type='button'
								onClick={() => setIsCustomCategory(false)}
								className='text-xs text-primary hover:underline'
							>
								返回选择已有分类
							</button>
						)}
					</div>
				)}

				<input
					type='datetime-local'
					placeholder='日期'
					className='input input-bordered w-full bg-base-100 focus:input-primary text-sm'
					value={form.date}
					onChange={e => updateForm({ date: e.target.value })}
				/>

				<div className='flex items-center gap-2 pt-1'>
					<input
						type='checkbox'
						id='encrypted-check'
						checked={form.encrypted || false}
						onChange={e => updateForm({ encrypted: e.target.checked })}
						className='checkbox checkbox-primary checkbox-sm'
					/>
					<label htmlFor='encrypted-check' className='cursor-pointer text-sm text-base-content/80 select-none'>
						加密文章（需要密码查看）
					</label>
				</div>

				<div className='flex items-center gap-2 pt-1'>
					<input
						type='checkbox'
						id='hidden-check'
						checked={form.hidden || false}
						onChange={e => updateForm({ hidden: e.target.checked })}
						className='checkbox checkbox-primary checkbox-sm'
					/>
					<label htmlFor='hidden-check' className='cursor-pointer text-sm text-base-content/80 select-none'>
						隐藏此文章（草稿）
					</label>
				</div>
			</div>
		</motion.div>
	)
}
