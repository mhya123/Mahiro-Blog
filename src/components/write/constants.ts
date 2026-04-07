import type { PublishForm } from './types'

export const WRITE_DRAFT_STORAGE_KEY = 'mahiro:write:draft:v1'

export function isDraftFormMeaningful(form: PublishForm): boolean {
	return Boolean(
		form.title.trim() ||
		form.slug.trim() ||
		form.md.trim() ||
		form.summary.trim() ||
		form.tags.length > 0 ||
		form.categories.length > 0,
	)
}
