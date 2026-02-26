import yaml from 'js-yaml'

export function parseFrontmatter(text: string): { data: any, content: string } {
    // Normalize CRLF to LF for consistent parsing across OS
    const normalized = text.replace(/\r\n/g, '\n')
    const match = normalized.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)
    if (match) {
        try {
            const data = yaml.load(match[1])
            return { data, content: match[2] }
        } catch (e) {
            console.error('Failed to parse frontmatter', e)
        }
    }
    return { data: {}, content: normalized }
}

export function stringifyFrontmatter(data: any, content: string): string {
    return `---\n${yaml.dump(data)}---\n${content}`
}
