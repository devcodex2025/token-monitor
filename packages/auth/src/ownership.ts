import { Buffer } from 'node:buffer'
import bs58 from 'bs58'
import { verifyEd25519 } from './verify'

export interface OwnershipMessageInput {
  domain: string
  mint: string
  address: string
  nonce?: string
}

/**
 * Human-readable ownership proof message (FR-F1 path b): "I own mint X".
 */
export function buildOwnershipMessage(input: OwnershipMessageInput): string {
  const lines = [
    `${input.domain} ownership proof`,
    `I own mint ${input.mint}`,
    `Wallet: ${input.address}`,
  ]
  if (input.nonce)
    lines.push(`Nonce: ${input.nonce}`)
  return lines.join('\n')
}

export interface OwnershipProof {
  address: string
  mint: string
  message: string
  signature: string
}

export type OwnershipFailure = 'malformed_input' | 'invalid_signature' | 'mint_mismatch'

export type OwnershipResult
  = | { ok: true }
    | { ok: false, reason: OwnershipFailure }

/**
 * Verifies a message-signed ownership proof. No private keys touch the backend.
 */
export function verifyOwnershipProof(proof: OwnershipProof, expectedMint: string): OwnershipResult {
  if (!proof.address || !proof.message || !proof.signature) {
    return { ok: false, reason: 'malformed_input' }
  }
  if (proof.mint !== expectedMint) {
    return { ok: false, reason: 'mint_mismatch' }
  }

  try {
    const signature = bs58.decode(proof.signature)
    const publicKey = bs58.decode(proof.address)
    if (!verifyEd25519(Buffer.from(proof.message), signature, publicKey)) {
      return { ok: false, reason: 'invalid_signature' }
    }
  }
  catch {
    return { ok: false, reason: 'malformed_input' }
  }

  return { ok: true }
}

/**
 * Automatic ownership path (FR-F1 path a): the connected wallet is the token's dev wallet.
 */
export function isAutoOwner(wallet: string, devWallet: string | null | undefined): boolean {
  return Boolean(devWallet) && wallet === devWallet
}
