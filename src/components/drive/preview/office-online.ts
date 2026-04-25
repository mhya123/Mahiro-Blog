import type { OfficePreviewData, OfficePreviewProvider } from './types'

function buildMicrosoftOfficeEmbedUrl(sourceUrl: string) {
    if (!sourceUrl) {
        return ''
    }

    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`
}

function buildGoogleOfficeEmbedUrl(sourceUrl: string) {
    if (!sourceUrl) {
        return ''
    }

    return `https://docs.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(sourceUrl)}`
}

function supportsMicrosoftOfficeEmbed(format: OfficePreviewData['format']) {
    return format === 'doc' || format === 'docx' || format === 'xlsx' || format === 'pptx'
}

export function buildOfficeOnlinePreviews(format: OfficePreviewData['format'], sourceUrl: string): OfficePreviewProvider[] {
    if (!supportsMicrosoftOfficeEmbed(format) || !sourceUrl) {
        return []
    }

    const providers: OfficePreviewProvider[] = [
        {
            id: 'microsoft',
            label: 'Microsoft Preview',
            mode: 'embed',
            url: buildMicrosoftOfficeEmbedUrl(sourceUrl),
        },
        {
            id: 'google',
            label: 'Google Preview',
            mode: 'embed',
            url: buildGoogleOfficeEmbedUrl(sourceUrl),
        },
    ]

    return providers.filter((provider) => Boolean(provider.url))
}
