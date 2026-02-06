import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PublishForm } from '../types'
import { Calendar, Bookmark, BookOpen, Folder, Tag, Info, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Import styles
import 'katex/dist/katex.min.css'

type WritePreviewProps = {
	form: PublishForm
	coverPreviewUrl: string | null
	onClose: () => void
	slug?: string
}

export function WritePreview({ form, coverPreviewUrl, onClose }: WritePreviewProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Estimate reading time and word count
    const wordCount = form.md.length
    const readTime = Math.ceil(wordCount / 400) + ' min'

    if (!mounted) return null

	return createPortal(
        <>
            <div className="fixed inset-0 z-[100] overflow-y-auto bg-base-200/90 backdrop-blur-sm">
                <div className="w-full max-w-[900px] mx-auto relative animate-in fade-in zoom-in duration-300 py-12 px-4">
                    {/* MainCard Structure */}
                    <div className="bg-base-100 rounded-2xl shadow-lg w-full overflow-hidden">
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
                            {/* PostInfo */}
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

                            {/* PostFilter */}
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

                            {/* Content */}
                            <div className="mt-8">
                                <article 
                                    id="content"
                                    className="prose prose-lg prose-code:text-base max-w-none text-justify prose-headings:scroll-mt-20 prose-img:rounded-2xl prose-img:mx-auto prose-img:cursor-pointer"
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            code({node, inline, className, children, ...props}: any) {
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
                                            img: (props: any) => (
                                                <img {...props} className="rounded-xl shadow-lg mx-auto" loading="lazy" />
                                            )
                                        }}
                                    >
                                        {form.md}
                                    </ReactMarkdown>
                                </article>
                            </div>

                            {/* License / Footer */}
                            <div className="mt-12 pt-8 border-t border-base-content/10">
                                <div className="text-center text-sm opacity-60 italic">
                                    感谢阅读！
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <motion.button
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className='fixed top-6 right-6 z-[110] btn btn-circle btn-neutral shadow-lg'
                onClick={onClose}>
                <X className="w-6 h-6" />
            </motion.button>
        </>,
        document.body
	)
}
