import type { PaymentObservation } from '../src/verify'
import { describe, expect, it } from 'vitest'
import { createInvoice } from '../src/invoice'
import { applyPayment, extendPrepaidUntil } from '../src/prepaid'
import { verifyPayment } from '../src/verify'

const VAULT = 'VaultWa11et11111111111111111111111111111111'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const NOW_MS = Date.UTC(2026, 10, 9, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

function config(overrides: Partial<Parameters<typeof createInvoice>[1]> = {}) {
  return {
    vaultWallet: VAULT,
    usdcMint: USDC_MINT,
    solUsdPrice: 150,
    now: () => NOW_MS,
    invoiceId: () => 'inv_test',
    ...overrides,
  }
}

function invoice(input: Partial<Parameters<typeof createInvoice>[0]> = {}) {
  return createInvoice({
    orgId: 'org-1',
    plan: 'turbo',
    periodDays: 1,
    asset: 'USDC',
    amountUsd: 29,
    ...input,
  }, config())
}

function observation(overrides: Partial<PaymentObservation> = {}): PaymentObservation {
  return {
    signature: 'sig-1',
    status: 'success',
    destination: VAULT,
    amount: 29,
    asset: 'USDC',
    memo: 'inv_test',
    ...overrides,
  }
}

describe('Solana Pay invoice (FR-C1)', () => {
  it('creates a USDC invoice with an SPL-token Solana Pay URL', () => {
    const result = invoice()

    expect(result.amountRequested).toBe(29)
    expect(result.solanaPayUrl.startsWith(`solana:${VAULT}?`)).toBe(true)
    expect(result.solanaPayUrl).toContain(`spl-token=${USDC_MINT}`)
    expect(result.solanaPayUrl).toContain('memo=inv_test')
  })

  it('prices SOL invoices from the Pyth snapshot with the +2% buffer', () => {
    const result = invoice({ asset: 'SOL' })

    expect(result.amountRequested).toBeCloseTo((29 / 150) * 1.02, 8)
    expect(result.solanaPayUrl).not.toContain('spl-token')
  })

  it('rejects a non-positive amount', () => {
    expect(() => invoice({ amountUsd: 0 })).toThrow()
  })
})

describe('payment verification (FR-C1)', () => {
  it('accepts a valid payment', () => {
    expect(verifyPayment(observation(), invoice(), { vaultWallet: VAULT }, NOW_MS + 1000))
      .toEqual({ ok: true })
  })

  it('accepts the invoice id as memo', () => {
    expect(verifyPayment(observation({ memo: 'inv_test' }), invoice(), { vaultWallet: VAULT }, NOW_MS + 1000).ok)
      .toBe(true)
  })

  it('rejects failed transactions', () => {
    expect(verifyPayment(observation({ status: 'failed' }), invoice(), { vaultWallet: VAULT }, NOW_MS))
      .toEqual({ ok: false, reason: 'failed' })
  })

  it('rejects a wrong destination', () => {
    expect(verifyPayment(observation({ destination: 'someone-else' }), invoice(), { vaultWallet: VAULT }, NOW_MS))
      .toEqual({ ok: false, reason: 'wrong_destination' })
  })

  it('rejects a wrong asset', () => {
    expect(verifyPayment(observation({ asset: 'SOL' }), invoice(), { vaultWallet: VAULT }, NOW_MS))
      .toEqual({ ok: false, reason: 'wrong_asset' })
  })

  it('rejects a wrong memo', () => {
    expect(verifyPayment(observation({ memo: 'other' }), invoice(), { vaultWallet: VAULT }, NOW_MS))
      .toEqual({ ok: false, reason: 'wrong_memo' })
  })

  it('rejects an underpayment beyond tolerance', () => {
    expect(verifyPayment(observation({ amount: 28 }), invoice(), { vaultWallet: VAULT }, NOW_MS))
      .toEqual({ ok: false, reason: 'insufficient_amount' })
  })

  it('rejects an expired invoice', () => {
    expect(verifyPayment(observation(), invoice(), { vaultWallet: VAULT }, NOW_MS + 31 * 60 * 1000))
      .toEqual({ ok: false, reason: 'expired' })
  })
})

describe('prepaid extension (AC-C1.2)', () => {
  it('extends from now when there is no current period', () => {
    const now = new Date(NOW_MS)
    expect(extendPrepaidUntil(null, 30, now).getTime()).toBe(NOW_MS + 30 * DAY)
  })

  it('extends from the current future period', () => {
    const now = new Date(NOW_MS)
    const current = new Date(NOW_MS + 10 * DAY)
    expect(extendPrepaidUntil(current, 30, now).getTime()).toBe(NOW_MS + 40 * DAY)
  })

  it('applies a verified payment once', () => {
    const result = applyPayment({
      invoice: invoice({ periodDays: 30 }),
      observation: observation(),
      currentPrepaidUntil: null,
      processedSignatures: new Set(),
      vaultWallet: VAULT,
      now: new Date(NOW_MS),
    })

    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.prepaidUntil.getTime()).toBe(NOW_MS + 30 * DAY)
    }
  })

  it('treats a replayed signature as a duplicate', () => {
    const result = applyPayment({
      invoice: invoice(),
      observation: observation(),
      currentPrepaidUntil: null,
      processedSignatures: new Set(['sig-1']),
      vaultWallet: VAULT,
      now: new Date(NOW_MS),
    })

    expect(result).toEqual({ status: 'duplicate' })
  })

  it('credits a second, different payment as an extension (not an error)', () => {
    const target = invoice({ periodDays: 30 })

    const first = applyPayment({
      invoice: target,
      observation: observation({ signature: 'sig-1' }),
      currentPrepaidUntil: null,
      processedSignatures: new Set(),
      vaultWallet: VAULT,
      now: new Date(NOW_MS),
    })

    expect(first.status).toBe('applied')
    if (first.status !== 'applied') return

    const second = applyPayment({
      invoice: target,
      observation: observation({ signature: 'sig-2' }),
      currentPrepaidUntil: first.prepaidUntil,
      processedSignatures: new Set(['sig-1']),
      vaultWallet: VAULT,
      now: new Date(NOW_MS + 10 * 60 * 1000),
    })

    expect(second.status).toBe('applied')
    if (second.status === 'applied') {
      expect(second.prepaidUntil.getTime()).toBe(NOW_MS + 60 * DAY)
    }
  })

  it('rejects an unverified observation', () => {
    const result = applyPayment({
      invoice: invoice(),
      observation: observation({ amount: 1 }),
      currentPrepaidUntil: null,
      processedSignatures: new Set(),
      vaultWallet: VAULT,
      now: new Date(NOW_MS),
    })

    expect(result).toEqual({ status: 'rejected', reason: 'insufficient_amount' })
  })
})
