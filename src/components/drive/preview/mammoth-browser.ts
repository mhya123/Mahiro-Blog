import mammoth from 'mammoth'

type MammothBrowserApi = {
    convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
}

export default mammoth as MammothBrowserApi
