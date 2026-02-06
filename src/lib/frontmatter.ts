import yaml from 'js-yaml'

export function parseFrontmatter(text: string): { data: any, content: string } {
    const match = text.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)
    if (match) {
        try {
            const data = yaml.load(match[1])
            return { data, content: match[2] }
        } catch (e) {
            console.error('Failed to parse frontmatter', e)
        }
    }
    return { data: {}, content: text }
}

export function stringifyFrontmatter(data: any, content: string): string {
    return `---\n${yaml.dump(data)}---\n${content}`
}
