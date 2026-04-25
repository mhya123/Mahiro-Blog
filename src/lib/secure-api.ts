import { SITE_API_BASE_URL } from '@/consts'

const VERSION = 'rsa-oaep-aes-gcm-v1'

type SecurePublicConfig = {
    enabled: boolean
    version: string
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

async function getSecurePublicConfig() {
    if (!publicConfigPromise) {
        publicConfigPromise = fetch(`${SITE_API_BASE_URL}/api/crypto/public-key`, {
            cache: 'no-store',
        }).then(async (response) => {
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load API encryption key')
            }
            if (!data?.enabled || data.version !== VERSION || !data.publicKey) {
                throw new Error('API RSA encryption is not available')
            }
            return data as SecurePublicConfig
        })
    }

    return publicConfigPromise
}

async function getSecurePublicKey() {
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

export async function encryptSecurePayload(payload: unknown) {
    const subtle = getSubtleCrypto()
    const publicKey = await getSecurePublicKey()
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

export async function secureApiRequest<T>(path: string, payload: unknown): Promise<T> {
    const encrypted = await encryptSecurePayload(payload)
    const response = await fetch(`${SITE_API_BASE_URL}${path}`, {
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
