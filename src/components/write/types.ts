export type PublishForm = {
	slug: string
	title: string
	md: string
	tags: string[]
	date: string
	summary: string
	aiModel?: string
	hidden?: boolean
	badge?: string
	categories: string[]
	fileFormat: 'md' | 'mdx'
	encrypted?: boolean
}

export type ImageItem =
	| { id: string; type: 'url'; url: string }
	| { id: string; type: 'file'; file: File; previewUrl: string; filename: string; hash?: string }
