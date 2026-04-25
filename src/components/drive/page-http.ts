export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : `Request failed with status ${response.status}`
        const error = new Error(message) as Error & { status?: number; details?: unknown }
        error.status = response.status
        error.details = data?.details
        throw error
    }

    return data as T
}

export function describeDriveError(error: unknown, fallback: string) {
    if (error instanceof Error) {
        if ('status' in error && (error as Error & { status?: number }).status === 403) {
            return '褰撳墠鏉冮檺涓嶅厑璁告墽琛岃繖涓綉鐩樻搷浣溿€?'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 404) {
            return '鐩爣鏂囦欢鎴栨帴鍙ｄ笉瀛樺湪锛屽彲鑳芥槸鍚庣杩樻病閮ㄧ讲鏈€鏂扮綉鐩樻帴鍙ｏ紝鎴栬鏂囦欢宸茬粡澶辨晥銆?'
        }

        if ('status' in error && (error as Error & { status?: number }).status === 401) {
            return '缃戠洏閴存潈澶辫触锛岃妫€鏌ュ悗绔噷鐨?AList 璐﹀彿銆佸瘑鐮佹垨 Token銆?'
        }

        return error.message || fallback
    }

    return fallback
}
