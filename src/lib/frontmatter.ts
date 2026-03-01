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
    // 过滤掉 undefined / null / 空字符串 / 空数组的字段，保持 YAML 干净
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null || value === '') continue
        if (Array.isArray(value) && value.length === 0) continue
        // draft: false 不需要写入
        if (key === 'draft' && value === false) continue
        cleaned[key] = value
    }
    return `---\n${yaml.dump(cleaned)}---\n${content}`
}
