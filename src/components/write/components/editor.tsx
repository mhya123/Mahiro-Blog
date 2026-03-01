import { motion } from 'motion/react'
import { useWriteStore } from '../stores/write-store'
import { INIT_DELAY } from '@/consts'
import { useCallback, useRef } from 'react'

/** slug 只允许：小写字母、数字、连字符、下划线 */
const SLUG_REGEX = /[^a-z0-9\-_]/g
const PLACEHOLDER = 'text'

/** 列表前缀匹配：- / * / 1. / 2. / - [ ] / - [x] 等 */
const LIST_PREFIX_RE = /^(\s*)([-*]|\d+\.)\s(\[[ x]\]\s)?/

export function WriteEditor() {
	const { form, updateForm, addFiles } = useWriteStore()
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// ─── 底层文本操作 ───────────────────────────────────

	/** 在光标处插入文本（优先用 execCommand 保留 undo 栈） */
	const insertText = useCallback((text: string) => {
		const textarea = textareaRef.current
		if (!textarea) return

		textarea.focus()
		if (!document.execCommand('insertText', false, text)) {
			// fallback
			const { selectionStart, selectionEnd, value } = textarea
			updateForm({ md: value.substring(0, selectionStart) + text + value.substring(selectionEnd) })
			const cur = selectionStart + text.length
			requestAnimationFrame(() => {
				textarea.setSelectionRange(cur, cur)
				textarea.focus()
			})
		}
	}, [updateForm])

	/** 用 marker 包裹选区，支持 toggle 去除；无选区时插入占位并选中 */
	const toggleWrap = useCallback((marker: string) => {
		const textarea = textareaRef.current
		if (!textarea) return

		const { selectionStart, selectionEnd, value } = textarea
		const selected = value.substring(selectionStart, selectionEnd)
		const mLen = marker.length

		const before = value.substring(0, selectionStart)
		const after = value.substring(selectionEnd)

		// 已有 marker → 去除
		if (before.endsWith(marker) && after.startsWith(marker) && selected) {
			textarea.setSelectionRange(selectionStart - mLen, selectionEnd + mLen)
			insertText(selected)
			return
		}

		// 添加 marker
		const inner = selected || PLACEHOLDER
		insertText(`${marker}${inner}${marker}`)
		if (!selected) {
			requestAnimationFrame(() => {
				textarea.setSelectionRange(selectionStart + mLen, selectionStart + mLen + PLACEHOLDER.length)
			})
		}
	}, [insertText])

	/** 获取光标所在行的起始位置 */
	const getLineStart = useCallback((value: string, pos: number) => {
		return value.lastIndexOf('\n', pos - 1) + 1
	}, [])

	/** 获取光标所在行完整文本 */
	const getCurrentLine = useCallback((value: string, pos: number) => {
		const start = getLineStart(value, pos)
		let end = value.indexOf('\n', pos)
		if (end === -1) end = value.length
		return value.substring(start, end)
	}, [getLineStart])

	// ─── 快捷键 ─────────────────────────────────────────

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = textareaRef.current
		if (!textarea) return
		const mod = e.ctrlKey || e.metaKey

		const { selectionStart, selectionEnd, value } = textarea
		const selected = value.substring(selectionStart, selectionEnd)

		// Ctrl/Cmd + B → 加粗
		if (mod && e.key === 'b') {
			e.preventDefault()
			toggleWrap('**')
			return
		}

		// Ctrl/Cmd + I → 斜体（排除已加粗的 **）
		if (mod && e.key === 'i') {
			e.preventDefault()
			const before = value.substring(0, selectionStart)
			const after = value.substring(selectionEnd)

			// 特殊判断：确保不会误判 ** 为斜体
			const isItalic = before.endsWith('*') && after.startsWith('*')
				&& !(before.endsWith('**') && after.startsWith('**'))

			if (isItalic && selected) {
				textarea.setSelectionRange(selectionStart - 1, selectionEnd + 1)
				insertText(selected)
			} else {
				const inner = selected || PLACEHOLDER
				insertText(`*${inner}*`)
				if (!selected) {
					requestAnimationFrame(() => {
						textarea.setSelectionRange(selectionStart + 1, selectionStart + 1 + PLACEHOLDER.length)
					})
				}
			}
			return
		}

		// Ctrl/Cmd + K → 链接
		if (mod && e.key === 'k') {
			e.preventDefault()
			const text = selected || PLACEHOLDER
			insertText(`[${text}](url)`)
			requestAnimationFrame(() => {
				const urlStart = selectionStart + text.length + 3
				textarea.setSelectionRange(urlStart, urlStart + 3)
			})
			return
		}

		// Ctrl/Cmd + Shift + K → 删除整行
		if (mod && e.shiftKey && e.key === 'K') {
			e.preventDefault()
			const lineStart = getLineStart(value, selectionStart)
			let lineEnd = value.indexOf('\n', selectionStart)
			if (lineEnd === -1) {
				lineEnd = value.length
				// 删除前一个换行符（如果有）
				if (lineStart > 0) {
					textarea.setSelectionRange(lineStart - 1, lineEnd)
					insertText('')
					return
				}
			}
			textarea.setSelectionRange(lineStart, lineEnd + 1)
			insertText('')
			return
		}

		// Ctrl/Cmd + D → 选中当前词（无选区时），有选区时不处理（留给浏览器默认）
		if (mod && e.key === 'd') {
			if (selectionStart === selectionEnd) {
				e.preventDefault()
				const wordStart = value.lastIndexOf(' ', selectionStart - 1) + 1
				let wordEnd = value.indexOf(' ', selectionStart)
				if (wordEnd === -1) wordEnd = value.length
				// 遇到换行也截断
				const nlBefore = value.lastIndexOf('\n', selectionStart - 1)
				const nlAfter = value.indexOf('\n', selectionStart)
				const start = Math.max(wordStart, nlBefore + 1)
				const end = nlAfter === -1 ? wordEnd : Math.min(wordEnd, nlAfter)
				textarea.setSelectionRange(start, end)
			}
			return
		}

		// Ctrl/Cmd + Shift + C → 行内代码
		if (mod && e.shiftKey && e.key === 'C') {
			e.preventDefault()
			toggleWrap('`')
			return
		}

		// Enter → 自动延续列表前缀（- / * / 1. / - [ ]）
		if (e.key === 'Enter' && !mod && !e.shiftKey) {
			const line = getCurrentLine(value, selectionStart)
			const match = LIST_PREFIX_RE.exec(line)
			if (match) {
				const [fullPrefix, indent, bullet] = match
				// 如果当前行只有前缀没有内容 → 清除前缀（结束列表）
				const content = line.substring(fullPrefix.length)
				if (!content.trim()) {
					e.preventDefault()
					const lineStart = getLineStart(value, selectionStart)
					textarea.setSelectionRange(lineStart, selectionStart)
					insertText('\n')
					return
				}

				e.preventDefault()
				// 有序列表递增数字
				let nextBullet = bullet
				const numMatch = /^(\d+)\./.exec(bullet)
				if (numMatch) {
					nextBullet = `${parseInt(numMatch[1]) + 1}.`
				}
				// checkbox 列表续接（默认未勾选）
				const checkbox = match[3] ? '[ ] ' : ''
				insertText(`\n${indent}${nextBullet} ${checkbox}`)
				return
			}
		}

		// Tab → 缩进
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault()
			insertText('\t')
			return
		}

		// Shift + Tab → 反缩进
		if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault()
			const lineStart = getLineStart(value, selectionStart)
			const line = getCurrentLine(value, selectionStart)

			if (line.startsWith('\t')) {
				textarea.setSelectionRange(lineStart, lineStart + 1)
				insertText('')
			} else if (line.startsWith('  ')) {
				textarea.setSelectionRange(lineStart, lineStart + 2)
				insertText('')
			}
			return
		}
	}

	// ─── 粘贴图片 ───────────────────────────────────────

	const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const items = e.clipboardData?.items
		if (!items) return

		const imageFiles: File[] = []
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.startsWith('image/')) {
				const file = items[i].getAsFile()
				if (file) imageFiles.push(file)
			}
		}

		if (imageFiles.length === 0) return

		e.preventDefault()
		const result = await addFiles(imageFiles).catch(() => [])
		if (result && result.length > 0) {
			const md = result
				.map(item => (item.type === 'url' ? `![](${item.url})` : `![](local-image:${item.id})`))
				.join('\n')
			insertText(md)
		}
	}

	// ─── slug 输入净化 ──────────────────────────────────

	const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const cleaned = e.target.value.toLowerCase().replace(SLUG_REGEX, '-')
		updateForm({ slug: cleaned })
	}, [updateForm])

	// ─── 渲染 ───────────────────────────────────────────

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: INIT_DELAY }}
			className='bg-base-100 flex min-h-[800px] w-full max-w-[800px] flex-col rounded-[40px] border border-base-200 p-8 shadow-xl'>
			<div className='mb-4 flex flex-col md:flex-row gap-4'>
				<input
					type='text'
					placeholder='标题'
					className='input input-bordered w-full md:flex-1 bg-base-100 focus:input-primary transition-all h-12 p-4 rounded-lg text-base font-medium'
					value={form.title}
					onChange={e => updateForm({ title: e.target.value })}
				/>
				<input
					type='text'
					placeholder='slug（xx-xx）'
					className='input input-bordered w-full md:w-[200px] bg-base-100 focus:input-primary transition-all h-12 p-4 rounded-lg text-base font-medium'
					value={form.slug}
					onChange={handleSlugChange}
				/>
			</div>
			<textarea
				ref={textareaRef}
				placeholder='Markdown 内容'
				className='textarea textarea-bordered h-[650px] w-full flex-1 resize-none rounded-2xl bg-base-100 p-6 text-base leading-relaxed focus:textarea-primary transition-all font-mono'
				value={form.md}
				onChange={e => updateForm({ md: e.target.value })}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
			/>
		</motion.div>
	)
}
