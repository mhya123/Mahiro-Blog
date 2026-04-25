import { createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes, constants } from 'node:crypto'

const VERSION = 'rsa-oaep-aes-gcm-v1'
const AES_KEY_BYTES = 32
const GCM_TAG_BYTES = 16

function toBuffer(base64) {
  return Buffer.from(String(base64 || ''), 'base64')
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

function assertEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid encrypted drive payload')
  }

  if (envelope.version !== VERSION || envelope.encrypted !== true) {
    throw new Error('Unsupported encrypted drive payload')
  }

  if (!envelope.key || !envelope.iv || !envelope.data) {
    throw new Error('Incomplete encrypted drive payload')
  }
}

function decryptAesGcm(aesKey, iv, encryptedPayload) {
  if (aesKey.length !== AES_KEY_BYTES) {
    throw new Error('Invalid encrypted drive key length')
  }

  if (encryptedPayload.length <= GCM_TAG_BYTES) {
    throw new Error('Invalid encrypted drive body')
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

export function createDriveCrypto({ enabled = true } = {}) {
  const keyPair = enabled
    ? generateKeyPairSync('rsa', {
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
    : null

  function getPublicConfig() {
    return {
      enabled: Boolean(keyPair),
      version: VERSION,
      algorithm: 'RSA-OAEP-256 + AES-256-GCM',
      publicKey: keyPair?.publicKey || '',
    }
  }

  function decryptEnvelope(envelope) {
    if (!keyPair) {
      throw new Error('Drive request encryption is disabled')
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
