function getBlockquoteLines(blockquote: HTMLElement): string[] {
	return (blockquote.textContent || '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
}

function createElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	className?: string,
	textContent?: string,
) {
	const element = document.createElement(tagName)
	if (className)
		element.className = className
	if (typeof textContent === 'string')
		element.textContent = textContent
	return element
}

export function decorateAiSummaryCards(root: ParentNode = document) {
	root.querySelectorAll<HTMLElement>('.prose blockquote').forEach((blockquote) => {
		if (blockquote.classList.contains('bdm-ai'))
			return

		const lines = getBlockquoteLines(blockquote)
		const [headerLine = '', ...bodyLines] = lines
		const match = headerLine.match(/^\[!ai\]\s*(.+)$/i)
		if (!match)
			return

		const model = match[1].trim()
		const bodyText = bodyLines.join('\n').trim()

		blockquote.classList.add('admonition', 'bdm-ai')
		blockquote.setAttribute('data-ai-model', model)
		blockquote.innerHTML = ''

		const title = createElement('span', 'bdm-title')
		const icon = createElement('span', 'bdm-title__icon', '\u26A1')
		icon.setAttribute('aria-hidden', 'true')
		title.append(icon, document.createTextNode('AI 摘要'))
		blockquote.appendChild(title)

		if (bodyText) {
			for (const paragraphText of bodyText.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)) {
				blockquote.appendChild(createElement('p', undefined, paragraphText))
			}
		}

		if (model) {
			blockquote.appendChild(createElement('div', 'bdm-footer', model))
		}
	})
}
