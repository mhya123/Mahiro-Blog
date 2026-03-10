import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { animate, remove } from 'animejs'
import type { PublishForm } from '../types'
import { Calendar, Bookmark, BookOpen, Folder, Tag, Info, X } from 'lucide-react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useWriteStore } from '../stores/write-store'

import 'katex/dist/katex.min.css'

type WritePreviewProps = {
	form: PublishForm
	coverPreviewUrl: string | null
	isOpen: boolean
	onRequestClose: () => void
	onExited: () => void
}

export function WritePreview({ form, coverPreviewUrl, isOpen, onRequestClose, onExited }: WritePreviewProps) {
	const [mounted, setMounted] = useState(false)
	const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null)
	const [isLightboxOpen, setIsLightboxOpen] = useState(false)
	const images = useWriteStore(state => state.images)
	const overlayRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const closeButtonRef = useRef<HTMLButtonElement>(null)
	const lightboxOverlayRef = useRef<HTMLDivElement>(null)
	const lightboxImageRef = useRef<HTMLImageElement>(null)
	const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null)
	const hasOpenedRef = useRef(false)
	const isClosingRef = useRef(false)
	const lightboxHasOpenedRef = useRef(false)
	const isLightboxClosingRef = useRef(false)
	const latestOnExitedRef = useRef(onExited)

	const closeLightbox = useCallback(() => {
		setIsLightboxOpen(false)
	}, [])

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		latestOnExitedRef.current = onExited
	}, [onExited])

	useEffect(() => {
		if (!mounted) return

		const html = document.documentElement
		const previousHtmlOverflow = html.style.overflow
		const previousOverflow = document.body.style.overflow

		html.style.overflow = 'hidden'
		document.body.style.overflow = 'hidden'

		return () => {
			html.style.overflow = previousHtmlOverflow
			document.body.style.overflow = previousOverflow
		}
	}, [mounted])

	useLayoutEffect(() => {
		if (!mounted || !overlayRef.current || !panelRef.current || !closeButtonRef.current) return

		const overlay = overlayRef.current
		const panel = panelRef.current
		const closeButton = closeButtonRef.current

		remove(overlay)
		remove(panel)
		remove(closeButton)

		if (isOpen) {
			isClosingRef.current = false
			overlay.style.opacity = '0'
			panel.style.opacity = '0'
			panel.style.transform = 'translateY(28px) scale(0.965)'
			closeButton.style.opacity = '0'
			closeButton.style.transform = 'translateY(-14px) scale(0.86)'

			animate(overlay, {
				opacity: 1,
				duration: 200,
				ease: 'outQuad',
			})
			animate(panel, {
				opacity: 1,
				translateY: 0,
				scale: 1,
				duration: 340,
				delay: 30,
				ease: 'out(4)',
			})
			animate(closeButton, {
				opacity: 1,
				translateY: 0,
				scale: 1,
				duration: 220,
				delay: 100,
				ease: 'out(3)',
			})

			hasOpenedRef.current = true
			return
		}

		if (!hasOpenedRef.current || isClosingRef.current) return

		isClosingRef.current = true
		animate(closeButton, {
			opacity: 0,
			translateY: -10,
			scale: 0.9,
			duration: 160,
			ease: 'inOutQuad',
		})
		animate(panel, {
			opacity: 0,
			translateY: 20,
			scale: 0.985,
			duration: 200,
			delay: 20,
			ease: 'inOut(3)',
		})
		animate(overlay, {
			opacity: 0,
			duration: 180,
			delay: 40,
			ease: 'inOutQuad',
			onComplete: () => {
				isClosingRef.current = false
				latestOnExitedRef.current()
			},
		})
	}, [isOpen, mounted])

	useLayoutEffect(() => {
		if (!mounted || !selectedImage || !lightboxOverlayRef.current || !lightboxImageRef.current || !lightboxCloseButtonRef.current) {
			return
		}

		const overlay = lightboxOverlayRef.current
		const image = lightboxImageRef.current
		const closeButton = lightboxCloseButtonRef.current

		remove(overlay)
		remove(image)
		remove(closeButton)

		if (isLightboxOpen) {
			isLightboxClosingRef.current = false
			overlay.style.opacity = '0'
			image.style.opacity = '0'
			image.style.transform = 'translateY(24px) scale(0.9)'
			closeButton.style.opacity = '0'
			closeButton.style.transform = 'translateY(-10px) scale(0.85)'

			animate(overlay, {
				opacity: 1,
				duration: 180,
				ease: 'outQuad',
			})
			animate(image, {
				opacity: 1,
				scale: 1,
				translateY: 0,
				duration: 280,
				delay: 30,
				ease: 'out(4)',
			})
			animate(closeButton, {
				opacity: 1,
				scale: 1,
				translateY: 0,
				duration: 200,
				delay: 80,
				ease: 'out(3)',
			})

			lightboxHasOpenedRef.current = true
			return
		}

		if (!lightboxHasOpenedRef.current || isLightboxClosingRef.current) return

		isLightboxClosingRef.current = true
		animate(closeButton, {
			opacity: 0,
			scale: 0.88,
			translateY: -8,
			duration: 140,
			ease: 'inOutQuad',
		})
		animate(image, {
			opacity: 0,
			scale: 0.94,
			translateY: 16,
			duration: 200,
			delay: 20,
			ease: 'inOut(3)',
		})
		animate(overlay, {
			opacity: 0,
			duration: 180,
			delay: 40,
			ease: 'inOutQuad',
			onComplete: () => {
				isLightboxClosingRef.current = false
				lightboxHasOpenedRef.current = false
				setSelectedImage(null)
			},
		})
	}, [isLightboxOpen, mounted, selectedImage])

	useEffect(() => {
		return () => {
			if (overlayRef.current)
				remove(overlayRef.current)
			if (panelRef.current)
				remove(panelRef.current)
			if (closeButtonRef.current)
				remove(closeButtonRef.current)
			if (lightboxOverlayRef.current)
				remove(lightboxOverlayRef.current)
			if (lightboxImageRef.current)
				remove(lightboxImageRef.current)
			if (lightboxCloseButtonRef.current)
				remove(lightboxCloseButtonRef.current)
		}
	}, [])

	useEffect(() => {
		if (!mounted) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return

			if (selectedImage) {
				closeLightbox()
				return
			}

			if (isOpen) {
				onRequestClose()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [closeLightbox, isOpen, mounted, onRequestClose, selectedImage])

	const wordCount = form.md.length
	const readTime = `${Math.ceil(wordCount / 400)} min`
	const localImageMap = useMemo(() => {
		const map = new Map<string, string>()

		for (const item of images) {
			if (item.type === 'file') {
				map.set(`local-image:${item.id}`, item.previewUrl)
			}
		}

		return map
	}, [images])

	if (!mounted) return null

	return createPortal(
		<>
			<div
				ref={overlayRef}
				className="preview-scrollbar fixed inset-0 z-[100] overflow-y-auto bg-base-200/90 backdrop-blur-sm opacity-0"
			>
				<div className="w-full max-w-[900px] mx-auto relative py-12 px-4">
					<div
						ref={panelRef}
						className="bg-base-100 rounded-2xl shadow-lg w-full overflow-hidden opacity-0"
					>
						{coverPreviewUrl ? (
							<div className="relative">
								<div className="aspect-video w-full overflow-hidden">
									<img
										src={coverPreviewUrl}
										alt={form.title}
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-6 lg:right-6 flex items-end justify-between gap-4">
									<div className="inline-block bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/40 shadow-lg">
										<h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white">{form.title}</h1>
									</div>
									{form.summary && (
										<div className="flex-shrink-0 hidden sm:block">
											<div className="group relative">
												<div className="bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/40 text-white shadow-lg cursor-help">
													<Info className="w-5 h-5" />
												</div>
												<div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-black/70 backdrop-blur-md text-white text-sm rounded-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
													{form.summary}
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="relative">
								<div className="aspect-video w-full overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
									<h1 className="text-4xl font-bold text-base-content/20">{form.title}</h1>
								</div>
								<div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-6 lg:right-6">
									<div className="inline-block bg-white/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/40 shadow-lg">
										<h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-base-content">{form.title}</h1>
									</div>
								</div>
							</div>
						)}

						<div className="p-4 md:p-8">
							<div className="flex flex-col sm:flex-row sm:justify-between gap-y-1 sm:gap-y-2 mb-2 sm:mb-4 text-[10px] sm:text-sm opacity-75">
								<div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2">
									{form.date && (
										<span className="flex items-center gap-1">
											<Calendar className="w-4 h-4 flex-shrink-0" />
											<span className="truncate">{form.date.replace('T', ' ')}</span>
										</span>
									)}
									<span className="flex flex-wrap items-center gap-1">
										<Bookmark className="w-4 h-4 flex-shrink-0" />
										<span className="truncate capitalize">Blog</span>
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
									<div className="flex items-center gap-1">
										<BookOpen className="w-4 h-4 flex-shrink-0" />
										<span className="truncate">{wordCount} 字 · {readTime}</span>
									</div>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2 mb-6">
								{form.categories?.map(cat => (
									<span key={cat} className="btn btn-xs bg-primary/5 hover:bg-primary text-primary hover:text-primary-content border-none hover:scale-110">
										<Folder className="w-4 h-4" />
										<span>{cat}</span>
									</span>
								))}
								{form.tags?.map(tag => (
									<span key={tag} className="btn btn-xs bg-secondary/5 hover:bg-secondary text-secondary hover:text-secondary-content border-none hover:scale-110">
										<Tag className="w-4 h-4" />
										<span>{tag}</span>
									</span>
								))}
							</div>

							<div className="mt-8">
								<article
									id="content"
									className="prose prose-lg prose-code:text-base max-w-none text-justify prose-headings:scroll-mt-20 prose-img:rounded-2xl prose-img:mx-auto prose-img:cursor-pointer"
								>
									<ReactMarkdown
										remarkPlugins={[remarkGfm, remarkMath]}
										rehypePlugins={[rehypeKatex]}
										urlTransform={(url) => {
											if (url.startsWith('local-image:')) {
												return url
											}

											return defaultUrlTransform(url)
										}}
										components={{
											code({ inline, className, children, ...props }: any) {
												const match = /language-(\w+)/.exec(className || '')
												return !inline && match ? (
													<SyntaxHighlighter
														style={oneDark}
														language={match[1]}
														PreTag="div"
														{...props}
													>
														{String(children).replace(/\n$/, '')}
													</SyntaxHighlighter>
												) : (
													<code className={className} {...props}>
														{children}
													</code>
												)
											},
											img: (props: any) => {
												const resolvedSrc = localImageMap.get(props.src || '') || props.src
												const alt = props.alt || form.title || 'Preview image'

												return (
													<span className="not-prose my-8 block">
														<span className="flex justify-center rounded-2xl border border-base-content/10 bg-base-200/35 p-3 shadow-sm">
															<button
																type="button"
																className="block cursor-zoom-in"
																onClick={() => {
																	if (!resolvedSrc) return
																	setSelectedImage({ src: resolvedSrc, alt })
																	setIsLightboxOpen(true)
																}}
															>
																<img
																	{...props}
																	src={resolvedSrc}
																	className="block max-h-[24rem] w-auto max-w-[88%] rounded-xl object-contain shadow-lg"
																	loading="lazy"
																/>
															</button>
														</span>
													</span>
												)
											},
										}}
									>
										{form.md}
									</ReactMarkdown>
								</article>
							</div>

							<div className="mt-12 pt-8 border-t border-base-content/10">
								<div className="text-center text-sm opacity-60 italic">
									感谢阅读
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{selectedImage && (
				<div
					ref={lightboxOverlayRef}
					className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md opacity-0"
					onClick={closeLightbox}
				>
					<button
						ref={lightboxCloseButtonRef}
						type="button"
						className="absolute top-5 right-5 btn btn-circle btn-neutral/90 border border-white/10 text-white shadow-xl opacity-0"
						onClick={closeLightbox}
					>
						<X className="w-5 h-5" />
					</button>

					<img
						ref={lightboxImageRef}
						src={selectedImage.src}
						alt={selectedImage.alt}
						className="block max-h-[88vh] max-w-[94vw] rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] opacity-0"
						onClick={(event) => event.stopPropagation()}
					/>
				</div>
			)}

			<button
				ref={closeButtonRef}
				className='fixed top-6 right-6 z-[110] btn btn-circle btn-neutral shadow-lg opacity-0'
				onClick={onRequestClose}
				type='button'
			>
				<X className="w-6 h-6" />
			</button>
		</>,
		document.body,
	)
}
