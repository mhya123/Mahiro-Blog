import { SITE_API_BASE_URL } from '@/consts'

const VERSION = 'rsa-oaep-aes-gcm-v1'

type SecurePublicConfig = {
    enabled: boolean
    publicKey: string
}

type SecureEncryptedResponse = {
    encrypted: true
    version: string
    iv: string
    data: string
}

let publicConfigPromise: Promise<SecurePublicConfig> | null = null
let importedPublicKeyPromise: Promise<CryptoKey> | null = null
const publicConfigPromises = new Map<string, Promise<SecurePublicConfig>>()
const importedPublicKeyPromises = new Map<string, Promise<CryptoKey>>()

function getSubtleCrypto() {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) {
        throw new Error('Current browser does not support WebCrypto encryption')
    }
    return subtle
}

function base64ToBytes(base64: string) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }
    return bytes
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    let binary = ''
    view.forEach((byte) => {
        binary += String.fromCharCode(byte)
    })
    return btoa(binary)
}

function pemToDer(pem: string) {
    return base64ToBytes(
        pem
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s+/g, ''),
    )
}

function normalizeBaseUrl(baseUrl = SITE_API_BASE_URL) {
    return String(baseUrl || '').replace(/\/+$/, '')
}

async function getSecurePublicConfig(baseUrl = SITE_API_BASE_URL) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    if (normalizedBaseUrl !== SITE_API_BASE_URL) {
        if (!publicConfigPromises.has(normalizedBaseUrl)) {
            publicConfigPromises.set(normalizedBaseUrl, fetch(`${normalizedBaseUrl}/api/crypto/public-key`, {
                cache: 'no-store',
            }).then(async (response) => {
                const data = await response.json().catch(() => ({}))
                if (!response.ok) {
                    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load API encryption key')
                }
                if (!data?.enabled || !data.publicKey) {
                    throw new Error('API RSA encryption is not available')
                }
                return data as SecurePublicConfig
            }))
        }

        return publicConfigPromises.get(normalizedBaseUrl)!
    }

    if (!publicConfigPromise) {
        publicConfigPromise = fetch(`${SITE_API_BASE_URL}/api/crypto/public-key`, {
            cache: 'no-store',
        }).then(async (response) => {
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load API encryption key')
            }
            if (!data?.enabled || !data.publicKey) {
                throw new Error('API RSA encryption is not available')
            }
            return data as SecurePublicConfig
        })
    }

    return publicConfigPromise
}

async function getSecurePublicKey(baseUrl = SITE_API_BASE_URL) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    if (normalizedBaseUrl !== SITE_API_BASE_URL) {
        if (!importedPublicKeyPromises.has(normalizedBaseUrl)) {
            importedPublicKeyPromises.set(normalizedBaseUrl, getSecurePublicConfig(normalizedBaseUrl).then((config) => {
                return getSubtleCrypto().importKey(
                    'spki',
                    pemToDer(config.publicKey),
                    {
                        name: 'RSA-OAEP',
                        hash: 'SHA-256',
                    },
                    false,
                    ['encrypt'],
                )
            }))
        }

        return importedPublicKeyPromises.get(normalizedBaseUrl)!
    }

    if (!importedPublicKeyPromise) {
        importedPublicKeyPromise = getSecurePublicConfig().then((config) => {
            return getSubtleCrypto().importKey(
                'spki',
                pemToDer(config.publicKey),
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256',
                },
                false,
                ['encrypt'],
            )
        })
    }

    return importedPublicKeyPromise
}

export async function encryptSecurePayload(payload: unknown, baseUrl = SITE_API_BASE_URL) {
    const subtle = getSubtleCrypto()
    const publicKey = await getSecurePublicKey(baseUrl)
    const aesKey = await subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt'],
    )
    const rawAesKey = await subtle.exportKey('raw', aesKey)
    const encryptedKey = await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedData = await subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
        },
        aesKey,
        new TextEncoder().encode(JSON.stringify(payload)),
    )

    return {
        aesKey,
        envelope: {
            encrypted: true,
            version: VERSION,
            key: bytesToBase64(encryptedKey),
            iv: bytesToBase64(iv),
            data: bytesToBase64(encryptedData),
        },
    }
}

export async function decryptSecurePayload<T>(aesKey: CryptoKey, envelope: SecureEncryptedResponse): Promise<T> {
    if (!envelope?.encrypted || envelope.version !== VERSION || !envelope.iv || !envelope.data) {
        throw new Error('Invalid encrypted API response')
    }

    const decrypted = await getSubtleCrypto().decrypt(
        {
            name: 'AES-GCM',
            iv: base64ToBytes(envelope.iv),
        },
        aesKey,
        base64ToBytes(envelope.data),
    )

    return JSON.parse(new TextDecoder().decode(decrypted)) as T
}

/**
 * 清除指定 baseUrl 的公钥缓存，用于密钥轮换恢复
 */
function clearPublicKeyCache(baseUrl = SITE_API_BASE_URL) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    if (normalizedBaseUrl !== SITE_API_BASE_URL) {
        publicConfigPromises.delete(normalizedBaseUrl)
        importedPublicKeyPromises.delete(normalizedBaseUrl)
    } else {
        publicConfigPromise = null
        importedPublicKeyPromise = null
    }
}

async function secureApiRequestOnce<T>(path: string, payload: unknown, baseUrl: string): Promise<T> {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    const encrypted = await encryptSecurePayload(payload, normalizedBaseUrl)
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(encrypted.envelope),
    })
    const data = await response.json().catch(() => ({}))
    const decrypted = await decryptSecurePayload<T | { error?: string; message?: string; details?: unknown }>(encrypted.aesKey, data)

    if (!response.ok) {
        const errorPayload = decrypted as { error?: string; message?: string; details?: unknown }
        const message = errorPayload.error || errorPayload.message || `Request failed with status ${response.status}`
        const error = new Error(message) as Error & { status?: number; details?: unknown }
        error.status = response.status
        error.details = errorPayload.details
        throw error
    }

    return decrypted as T
}

/**
 * 加密 API 请求。
 * 当收到 500 错误或解密失败时，清除公钥缓存并自动重试一次（应对后端密钥轮换场景）。
 */
export async function secureApiRequest<T>(path: string, payload: unknown, baseUrl = SITE_API_BASE_URL): Promise<T> {
    try {
        return await secureApiRequestOnce<T>(path, payload, baseUrl)
    } catch (firstError) {
        const status = (firstError as Error & { status?: number }).status
        const isDecryptionError = firstError instanceof Error && (
            firstError.message.includes('decrypt')
            || firstError.message.includes('Encrypted')
            || firstError.message.includes('Invalid encrypted')
        )

        // 仅在 500 或解密失败时重试（可能是密钥不匹配）
        if (status === 500 || isDecryptionError) {
            clearPublicKeyCache(baseUrl)
            try {
                return await secureApiRequestOnce<T>(path, payload, baseUrl)
            } catch {
                // 重试也失败，抛原始错误
            }
        }

        throw firstError
    }
}

