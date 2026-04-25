import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SITE_LOCAL_API_BASE_URL, SITE_REMOTE_API_BASE_URL } from '@/consts'
import type { AiModelDefinition } from '@/lib/ai-models'
import { secureApiRequest } from '@/lib/secure-api'
import { useWriteStore } from '../../stores/write-store'
import { CustomSelect } from '../ui/custom-select'
import { TagInput } from '../ui/tag-input'

type MetaSectionProps = {
	delay?: number
	categories?: string[]
	aiModels?: AiModelDefinition[]
}

type AiSummaryPayload = {
	summary?: string
	model?: string
	modelName?: string
}

function getSummaryErrorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : String(error || '')
	if (/failed to fetch|networkerror|load api encryption key|encryption key/i.test(message)) {
		return 'AI 摘要生成失败：暂时无法连接摘要后端，请检查本地/远程后端是否正常运行。'
	}
	if (/unsupported aimodel/i.test(message)) {
		return 'AI 摘要生成失败：当前后端不支持这个模型，请换一个模型后重试。'
	}
	if (/missing .*api_key|api key/i.test(message)) {
		return 'AI 摘要生成失败：后端 API Key 没有配置好，请检查服务端环境变量。'
	}
	return `AI 摘要生成失败：${message || '请稍后重试'}`
}

export function MetaSection({ delay = 0, categories = [], aiModels = [] }: MetaSectionProps) {
	const { form, updateForm, setAiSummaryStatus } = useWriteStore()
	const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
	const [isCustomCategory, setIsCustomCategory] = useState(() => {
		if (form.categories.length === 0) return false
		return form.categories.length > 1 || (form.categories.length === 1 && !categories.includes(form.categories[0]))
	})

	const categoryOptions = [
		...categories.map((category) => ({ value: category, label: category })),
		{ value: '__custom__', label: '+ 自定义 / 多分类...' }
	]

	const aiModelOptions = [
		{ value: '', label: '不启用 AI 摘要' },
		...aiModels.map((model) => ({
			value: model.id,
			label: `${model.name} · ${model.brand}`
		}))
	]

	const aiSummaryChannelOptions = [
		{ value: 'remote', label: '远程后端' },
		{ value: 'local', label: '本地后端' }
	]

	const requestSummary = async (apiBaseUrl: string) => {
		const payload = await secureApiRequest<AiSummaryPayload>('/api/ai/secure', {
			action: 'summary',
			payload: {
				title: form.title,
				content: form.md,
				summary: form.summary,
				aiModel: form.aiModel
			}
		}, apiBaseUrl)

		if (!payload?.summary || typeof payload.summary !== 'string') {
			throw new Error('AI summary API did not return a valid summary')
		}

		return payload
	}

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
			setAiSummaryStatus('generating')
			const apiBaseUrl = form.aiSummaryChannel === 'local' ? SITE_LOCAL_API_BASE_URL : SITE_REMOTE_API_BASE_URL
			let lastError: unknown = null

			for (let attempt = 1; attempt <= 2; attempt += 1) {
				try {
					const payload = await requestSummary(apiBaseUrl)
					updateForm({ summary: payload.summary })
					setAiSummaryStatus('ready')
					toast.success(`摘要已由 ${payload.modelName || payload.model || form.aiModel} 生成`)
					return
				} catch (error) {
					lastError = error
					if (attempt === 1) {
						toast.info('AI 摘要生成失败，正在自动重试一次...')
					}
				}
			}

			setAiSummaryStatus('failed')
			toast.error(getSummaryErrorMessage(lastError), {
				description: '已取消保存保护，你仍然可以手动编辑摘要后保存文章。'
			})
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
					onChange={e => {
						updateForm({ summary: e.target.value })
						setAiSummaryStatus('idle')
					}}
				/>

				<div className='space-y-2'>
					<div className='text-xs font-medium text-base-content/70'>AI 摘要通道</div>
					<CustomSelect
						value={form.aiSummaryChannel || 'remote'}
						onChange={value => updateForm({ aiSummaryChannel: value as 'remote' | 'local' })}
						options={aiSummaryChannelOptions}
						placeholder='选择摘要生成通道'
					/>

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
								生成中...
							</>
						) : form.summary ? '重新生成摘要' : '生成摘要'}
					</button>
					<p className='text-xs text-base-content/50'>
						点击生成摘要后，请等待结果写入上方摘要框再保存文章。失败时会自动重试一次，仍失败则释放保存保护。
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
								className='btn btn-xs btn-ghost text-base-content/60'
								onClick={() => setIsCustomCategory(false)}
							>
								返回分类选择
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
