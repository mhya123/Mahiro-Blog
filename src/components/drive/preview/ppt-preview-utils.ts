function normalizeSlideText(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^[\u200B\uFEFF]+|[\u200B\uFEFF]+$/g, '')
        .trim()
}

function decodeXmlText(value: string) {
    return value
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&')
}

function extractPptParagraphTexts(xmlFragment: string) {
    const paragraphs = xmlFragment.match(/<a:p\b[\s\S]*?<\/a:p>/g) || []

    return paragraphs
        .map((paragraph) => {
            const withLineBreaks = paragraph.replace(/<a:br\s*\/>/g, '\n')
            const text = Array.from(withLineBreaks.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
                .map((match) => decodeXmlText(match[1] || ''))
                .join('')
            return normalizeSlideText(text)
        })
        .filter(Boolean)
}

function extractPptTableRows(xmlFragment: string) {
    const rows = xmlFragment.match(/<a:tr\b[\s\S]*?<\/a:tr>/g) || []

    return rows
        .map((row) => {
            const cells = (row.match(/<a:tc\b[\s\S]*?<\/a:tc>/g) || [])
                .map((cell) => extractPptParagraphTexts(cell).join(' ').trim())
                .filter(Boolean)
            return normalizeSlideText(cells.join(' | '))
        })
        .filter(Boolean)
}

export function sortSlideFiles(files: string[]) {
    return [...files].sort((left, right) => {
        const leftMatch = left.match(/slide(\d+)\.xml$/)
        const rightMatch = right.match(/slide(\d+)\.xml$/)
        return Number(leftMatch?.[1] || 0) - Number(rightMatch?.[1] || 0)
    })
}

export function buildPptSlideContent(slideXml: string, index: number) {
    const shapeBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || []
    const titleCandidates: string[] = []
    const bodyCandidates: string[] = []

    for (const shape of shapeBlocks) {
        const lines = extractPptParagraphTexts(shape)
        if (!lines.length) {
            continue
        }

        const isTitle = /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(shape)
        const isSubtitle = /<p:ph\b[^>]*type="subTitle"/.test(shape)

        if (isTitle) {
            titleCandidates.push(...lines)
            continue
        }

        if (isSubtitle) {
            bodyCandidates.push(...lines)
            continue
        }

        bodyCandidates.push(...lines)
    }

    const graphicFrames = slideXml.match(/<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g) || []
    for (const frame of graphicFrames) {
        bodyCandidates.push(...extractPptTableRows(frame))
    }

    const title = titleCandidates.find(Boolean) || bodyCandidates[0] || `Slide ${index + 1}`
    const body = bodyCandidates
        .map((line) => normalizeSlideText(line))
        .filter(Boolean)
        .filter((line) => line !== title)
        .filter((line, lineIndex, lines) => lines.indexOf(line) === lineIndex)

    return { title, body }
}
