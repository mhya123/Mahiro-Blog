type HastNode = {
	type?: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
	value?: string
}

function createElement(tagName: string, properties: Record<string, unknown> = {}, children: HastNode[] = []): HastNode {
	return {
		type: 'element',
		tagName,
		properties,
		children,
	}
}

function createText(value: string): HastNode {
	return {
		type: 'text',
		value,
	}
}

function getTextContent(node: HastNode | null | undefined): string {
	if (!node)
		return ''

	if (node.type === 'text')
		return node.value || ''

	if (!Array.isArray(node.children))
		return ''

	return node.children.map(getTextContent).join('')
}

function normalizeMultilineText(value: string): string {
	return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function toClassNameList(value: unknown): string[] {
	if (Array.isArray(value))
		return value.filter(Boolean).map(String)

	if (typeof value === 'string')
		return value.split(/\s+/).filter(Boolean)

	return []
}

function visit(node: HastNode, visitor: (node: HastNode) => void) {
	visitor(node)

	if (!Array.isArray(node.children))
		return

	for (const child of node.children) {
		visit(child, visitor)
	}
}

export function rehypeAiSummaryCards() {
	return (tree: HastNode) => {
		visit(tree, (node) => {
			if (node.type !== 'element' || node.tagName !== 'blockquote' || !Array.isArray(node.children))
				return

			const firstElement = node.children.find(child => child.type === 'element')
			if (!firstElement || firstElement.tagName !== 'p')
				return

			const firstParagraphText = normalizeMultilineText(getTextContent(firstElement)).trim()
			const [headerLine = '', ...restLines] = firstParagraphText.split('\n')
			const match = headerLine.trim().match(/^\[!ai\]\s*(.+)$/i)
			if (!match)
				return

			const model = match[1].trim()
			const className = Array.from(new Set([
				...toClassNameList(node.properties?.className),
				'admonition',
				'bdm-ai',
			]))
			const firstParagraphBody = restLines.join('\n').trim()
			const bodyChildren = [
				...(firstParagraphBody
					? [createElement('p', {}, [createText(firstParagraphBody)])]
					: []),
				...node.children.filter(child => child !== firstElement),
			]

			node.properties = {
				...node.properties,
				className,
				'data-ai-model': model,
			}

			node.children = [
				createElement('span', { className: ['bdm-title'] }, [
					createElement('span', { className: ['bdm-title__icon'], ariaHidden: 'true' }, [
							createText('\u26A1'),
					]),
					createElement('span', {}, [
						createText('AI \u6458\u8981'),
					]),
				]),
				...bodyChildren,
				...(model
					? [createElement('div', { className: ['bdm-footer'] }, [createText(model)])]
					: []),
			]
		})
	}
}
