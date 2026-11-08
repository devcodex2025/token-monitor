import type { KeyObject } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import bs58 from 'bs58'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createInMemoryNonceStore,
  createInMemorySessionStore,
  createSiwsService,
} from '../src/index'

function makeWallet(): { address: string, privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const spki = publicKey.export({ format: 'der', type: 'spki' })
  const raw = spki.subarray(spki.length - 32)
  return { address: bs58.encode(raw), privateKey }
}

function sign(message: string, privateKey: KeyObject): string {
  return bs58.encode(cryptoSign(null, Buffer.from(message), privateKey))
}

describe('SIWS auth core (FR-A3)', () => {
  let now = 0
  const clock = () => now

  beforeEach(() => {
    now = 1_700_000_000_000
  })

  function makeService() {
    return createSiwsService({
      domain: 'tmr.watch',
      nonceStore: createInMemoryNonceStore(),
      now: clock,
      nonceTtlMs: 5 * 60 * 1000,
    })
  }

  it('AC-A3.1: accepts a valid signature and returns the wallet', async () => {
    const service = makeService()
    const wallet = makeWallet()

    const issued = await service.issueNonce(wallet.address)
    const result = await service.verify({
      address: wallet.address,
      nonce: issued.nonce,
      signature: sign(issued.message, wallet.privateKey),
    })

    expect(result).toEqual({ ok: true, wallet: wallet.address })
  })

  it('AC-A3.2: rejects an invalid signature', async () => {
    const service = makeService()
    const wallet = makeWallet()

    const issued = await service.issueNonce(wallet.address)
    const result = await service.verify({
      address: wallet.address,
      nonce: issued.nonce,
      signature: sign(`${issued.message} tampered`, wallet.privateKey),
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('AC-A3.2: rejects nonce reuse', async () => {
    const service = makeService()
    const wallet = makeWallet()

    const issued = await service.issueNonce(wallet.address)
    const signature = sign(issued.message, wallet.privateKey)

    expect((await service.verify({ address: wallet.address, nonce: issued.nonce, signature })).ok).toBe(true)
    expect(await service.verify({ address: wallet.address, nonce: issued.nonce, signature }))
      .toEqual({ ok: false, reason: 'nonce_not_found' })
  })

  it('rejects an expired nonce (5 min TTL)', async () => {
    const service = makeService()
    const wallet = makeWallet()

    const issued = await service.issueNonce(wallet.address)
    const signature = sign(issued.message, wallet.privateKey)
    now += 5 * 60 * 1000

    expect(await service.verify({ address: wallet.address, nonce: issued.nonce, signature }))
      .toEqual({ ok: false, reason: 'nonce_expired' })
  })

  it('rejects a wallet that does not own the nonce', async () => {
    const service = makeService()
    const owner = makeWallet()
    const attacker = makeWallet()

    const issued = await service.issueNonce(owner.address)
    const result = await service.verify({
      address: attacker.address,
      nonce: issued.nonce,
      signature: sign(issued.message, attacker.privateKey),
    })

    expect(result).toEqual({ ok: false, reason: 'address_mismatch' })
  })

  it('binds the signed message to the configured domain and nonce', async () => {
    const service = makeService()
    const wallet = makeWallet()
    const issued = await service.issueNonce(wallet.address)

    expect(issued.message).toContain('tmr.watch wants you to sign in')
    expect(issued.message).toContain(`Nonce: ${issued.nonce}`)
    expect(issued.message).toContain(wallet.address)
  })

  it('creates, resolves and revokes sessions bound to a wallet', () => {
    const sessions = createInMemorySessionStore({ ttlMs: 1000, now: clock })
    const session = sessions.create('wallet-1')

    expect(session.wallet).toBe('wallet-1')
    expect(sessions.get(session.token)?.wallet).toBe('wallet-1')

    now += 1000
    expect(sessions.get(session.token)).toBeNull()

    const fresh = sessions.create('wallet-2')
    sessions.revoke(fresh.token)
    expect(sessions.get(fresh.token)).toBeNull()
  })
})
