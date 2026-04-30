import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes, constants } from 'node:crypto'

const VERSION = 'rsa-oaep-aes-gcm-v1'
const AES_KEY_BYTES = 32
const GCM_TAG_BYTES = 16
const __dirname = dirname(fileURLToPath(import.meta.url))

function toBuffer(base64) {
  return Buffer.from(String(base64 || ''), 'base64')
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

function assertEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid encrypted API payload')
  }

  if (envelope.version !== VERSION || envelope.encrypted !== true) {
    throw new Error('Unsupported encrypted API payload')
  }

  if (!envelope.key || !envelope.iv || !envelope.data) {
    throw new Error('Incomplete encrypted API payload')
  }
}

function decryptAesGcm(aesKey, iv, encryptedPayload) {
  if (aesKey.length !== AES_KEY_BYTES) {
    throw new Error('Invalid encrypted API key length')
  }

  if (encryptedPayload.length <= GCM_TAG_BYTES) {
    throw new Error('Invalid encrypted API body')
  }

  const ciphertext = encryptedPayload.subarray(0, encryptedPayload.length - GCM_TAG_BYTES)
  const tag = encryptedPayload.subarray(encryptedPayload.length - GCM_TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function encryptAesGcm(aesKey, payload) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    encrypted: true,
    version: VERSION,
    iv: toBase64(iv),
    data: toBase64(Buffer.concat([ciphertext, tag])),
  }
}

function resolveKeyPaths() {
  const certDir = resolve(__dirname, '../../', process.env.API_RSA_CERT_DIR || 'certs')
  return {
    certDir,
    privateKeyPath: resolve(process.env.API_RSA_PRIVATE_KEY_PATH || `${certDir}/api-rsa-private.pem`),
    publicKeyPath: resolve(process.env.API_RSA_PUBLIC_KEY_PATH || `${certDir}/api-rsa-public.pem`),
  }
}

function loadOrCreateKeyPair() {
  const { certDir, privateKeyPath, publicKeyPath } = resolveKeyPaths()

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    return {
      privateKey: readFileSync(privateKeyPath, 'utf8'),
      publicKey: readFileSync(publicKeyPath, 'utf8'),
      privateKeyPath,
      publicKeyPath,
      generated: false,
    }
  }

  mkdirSync(certDir, { recursive: true })
  const keyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })

  writeFileSync(privateKeyPath, keyPair.privateKey, { mode: 0o600 })
  writeFileSync(publicKeyPath, keyPair.publicKey, { mode: 0o644 })

  return {
    ...keyPair,
    privateKeyPath,
    publicKeyPath,
    generated: true,
  }
}

export function createDriveCrypto({ enabled = true } = {}) {
  const keyPair = enabled ? loadOrCreateKeyPair() : null

  function getPublicConfig() {
    return {
      enabled: Boolean(keyPair),
      publicKey: keyPair?.publicKey || '',
    }
  }

  function decryptEnvelope(envelope) {
    if (!keyPair) {
      throw new Error('API request encryption is disabled')
    }

    assertEnvelope(envelope)

    const aesKey = privateDecrypt(
      {
        key: keyPair.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      toBuffer(envelope.key),
    )
    const plaintext = decryptAesGcm(aesKey, toBuffer(envelope.iv), toBuffer(envelope.data))

    return {
      aesKey,
      payload: JSON.parse(plaintext.toString('utf8')),
    }
  }

  function encryptResponse(aesKey, payload) {
    if (!keyPair) {
      return payload
    }

    return encryptAesGcm(aesKey, Buffer.from(JSON.stringify(payload), 'utf8'))
  }

  return {
    getPublicConfig,
    decryptEnvelope,
    encryptResponse,
  }
}
