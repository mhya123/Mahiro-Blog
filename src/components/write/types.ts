export type PublishForm = {
	slug: string
	title: string
	md: string
	tags: string[]
	date: string
	summary: string
	hidden?: boolean
	badge?: string
	category?: string // RyuChan uses categories (array), but form might use single string or array.
	// I'll adapt to RyuChan schema: categories: string[]
	categories: string[]
	fileFormat: 'md' | 'mdx' // 文件格式选择
}

export type ImageItem = { id: string; type: 'url'; url: string } | { id: string; type: 'file'; file: File; previewUrl: string; filename: string; hash?: string }
