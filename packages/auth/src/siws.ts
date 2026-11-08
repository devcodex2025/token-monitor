import type { NonceStore, SiwsVerification } from './types'
import { Buffer } from 'node:buffer'
import bs58 from 'bs58'
import { generateNonce } from './nonce'
import { verifyEd25519 } from './verify'

const DEFAULT_STATEMENT
  = 'Sign in to Token Monitor. This request will not trigger a blockchain transaction or cost any gas fees.'

const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000

export interface SiwsServiceOptions {
  domain: string
  nonceStore: NonceStore
  now?: () => number
  nonceTtlMs?: number
  statement?: string
}

export interface IssuedNonce {
  nonce: string
  message: string
  expiresAt: number
}

export interface VerifyInput {
  address: string
  nonce: string
  signature: string
}

export interface SiwsService {
  issueNonce: (address: string) => Promise<IssuedNonce>
  verify: (input: VerifyInput) => Promise<SiwsVerification>
}

export function buildSiwsMessage(input: {
  domain: string
  address: string
  nonce: string
  issuedAt: number
  expiresAt: number
  statement?: string
}): string {
  const statement = input.statement ?? DEFAULT_STATEMENT
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    '',
    statement,
    '',
    `Nonce: ${input.nonce}`,
    `Issued At: ${new Date(input.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(input.expiresAt).toISOString()}`,
  ].join('\n')
}

/**
 * SIWS verification core: nonce (single-use, 5 min TTL) -> ed25519 signature check.
 * The server rebuilds the signed message from the stored nonce record, so clients cannot
 * tamper with the domain/address fields.
 */
export function createSiwsService(options: SiwsServiceOptions): SiwsService {
  const now = options.now ?? Date.now
  const ttlMs = options.nonceTtlMs ?? DEFAULT_NONCE_TTL_MS

  async function issueNonce(address: string): Promise<IssuedNonce> {
    const nonce = generateNonce()
    const issuedAt = now()
    const expiresAt = issuedAt + ttlMs

    await options.nonceStore.issue({
      nonce,
      address,
      domain: options.domain,
      issuedAt,
      expiresAt,
    })

    return {
      nonce,
      message: buildSiwsMessage({
        domain: options.domain,
        address,
        nonce,
        issuedAt,
        expiresAt,
        statement: options.statement,
      }),
      expiresAt,
    }
  }

  async function verify(input: VerifyInput): Promise<SiwsVerification> {
    if (!input.address || !input.nonce || !input.signature) {
      return { ok: false, reason: 'malformed_input' }
    }

    const record = await options.nonceStore.consume(input.nonce)
    if (!record) {
      return { ok: false, reason: 'nonce_not_found' }
    }
    if (now() >= record.expiresAt) {
      return { ok: false, reason: 'nonce_expired' }
    }
    if (record.address !== input.address) {
      return { ok: false, reason: 'address_mismatch' }
    }

    const message = buildSiwsMessage({
      domain: record.domain,
      address: record.address,
      nonce: record.nonce,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      statement: options.statement,
    })

    try {
      const signature = bs58.decode(input.signature)
      const publicKey = bs58.decode(input.address)
      if (!verifyEd25519(Buffer.from(message), signature, publicKey)) {
        return { ok: false, reason: 'invalid_signature' }
      }
    }
    catch {
      return { ok: false, reason: 'malformed_input' }
    }

    return { ok: true, wallet: input.address }
  }

  return { issueNonce, verify }
}
