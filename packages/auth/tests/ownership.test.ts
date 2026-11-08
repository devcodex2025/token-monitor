import type { KeyObject } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { buildOwnershipMessage, isAutoOwner, verifyOwnershipProof } from '../src/ownership'

const MINT = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump'

function makeWallet(): { address: string, privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const spki = publicKey.export({ format: 'der', type: 'spki' })
  return { address: bs58.encode(spki.subarray(spki.length - 32)), privateKey }
}

function sign(message: string, privateKey: KeyObject): string {
  return bs58.encode(cryptoSign(null, Buffer.from(message), privateKey))
}

describe('ownership proof (FR-F1)', () => {
  it('accepts a valid signed ownership message', () => {
    const wallet = makeWallet()
    const message = buildOwnershipMessage({ domain: 'tmr.watch', mint: MINT, address: wallet.address })

    expect(message).toContain(`I own mint ${MINT}`)
    expect(verifyOwnershipProof({
      address: wallet.address,
      mint: MINT,
      message,
      signature: sign(message, wallet.privateKey),
    }, MINT)).toEqual({ ok: true })
  })

  it('rejects an invalid signature', () => {
    const wallet = makeWallet()
    const message = buildOwnershipMessage({ domain: 'tmr.watch', mint: MINT, address: wallet.address })

    expect(verifyOwnershipProof({
      address: wallet.address,
      mint: MINT,
      message,
      signature: sign(`${message} tampered`, wallet.privateKey),
    }, MINT)).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('rejects a mint mismatch', () => {
    const wallet = makeWallet()
    const message = buildOwnershipMessage({ domain: 'tmr.watch', mint: MINT, address: wallet.address })

    expect(verifyOwnershipProof({
      address: wallet.address,
      mint: 'other-mint',
      message,
      signature: sign(message, wallet.privateKey),
    }, MINT)).toEqual({ ok: false, reason: 'mint_mismatch' })
  })

  it('rejects malformed input', () => {
    expect(verifyOwnershipProof({ address: '', mint: MINT, message: '', signature: '' }, MINT))
      .toEqual({ ok: false, reason: 'malformed_input' })
    expect(verifyOwnershipProof({ address: 'x', mint: MINT, message: 'm', signature: '!!' }, MINT))
      .toEqual({ ok: false, reason: 'malformed_input' })
  })

  it('auto-approves when the wallet is the dev wallet', () => {
    expect(isAutoOwner('dev', 'dev')).toBe(true)
    expect(isAutoOwner('other', 'dev')).toBe(false)
    expect(isAutoOwner('dev', null)).toBe(false)
  })
})
