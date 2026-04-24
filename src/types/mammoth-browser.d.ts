declare module 'mammoth/mammoth.browser' {
    export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
    export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>

    const mammoth: {
        convertToHtml: typeof convertToHtml
        extractRawText: typeof extractRawText
    }

    export default mammoth
}
