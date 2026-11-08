import { Buffer } from 'node:buffer'
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

/** Ed25519 SubjectPublicKeyInfo prefix (RFC 8410). */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/**
 * Verifies an Ed25519 signature over raw bytes using a 32-byte public key.
 * No user private keys ever touch the backend — only the public wallet address and signature.
 */
export function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) {
    return false
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]),
      format: 'der',
      type: 'spki',
    })
    return cryptoVerify(null, Buffer.from(message), key, Buffer.from(signature))
  }
  catch {
    return false
  }
}
