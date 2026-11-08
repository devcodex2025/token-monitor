import type { NonceRecord, NonceStore } from './types'
import { randomBytes } from 'node:crypto'

/**
 * In-memory single-use nonce store. Production wiring uses Redis with the same contract.
 * Expired records are returned as-is so the caller can distinguish expiry from an unknown nonce;
 * consume() always removes the record to prevent replay.
 */
export function createInMemoryNonceStore(): NonceStore {
  const records = new Map<string, NonceRecord>()

  return {
    issue(record) {
      records.set(record.nonce, record)
    },
    consume(nonce) {
      const record = records.get(nonce)
      if (!record)
        return null
      records.delete(nonce)
      return record
    },
  }
}

export function generateNonce(): string {
  return randomBytes(24).toString('base64url')
}
