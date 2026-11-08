import type { Invoice, PaymentAsset } from './invoice'

export interface PaymentObservation {
  signature: string
  status: 'success' | 'failed'
  destination: string
  /** Normalized amount: USDC units for USDC, SOL for SOL. */
  amount: number
  asset: PaymentAsset
  memo: string | null
  blockTime?: number
}

export interface VerifyConfig {
  vaultWallet: string
  /** Absolute tolerance on the requested amount (default 1e-6). */
  amountTolerance?: number
}

export type VerifyFailureReason
  = | 'failed'
    | 'wrong_destination'
    | 'wrong_asset'
    | 'wrong_memo'
    | 'insufficient_amount'
    | 'expired'

export type VerifyResult
  = | { ok: true }
    | { ok: false, reason: VerifyFailureReason }

/**
 * Verifies a settled Solana Pay transfer against an invoice (FR-C1).
 * Memo must equal the invoice memo and the amount must cover amountRequested.
 */
export function verifyPayment(
  observation: PaymentObservation,
  invoice: Invoice,
  config: VerifyConfig,
  now: number = Date.now(),
): VerifyResult {
  if (observation.status !== 'success')
    return { ok: false, reason: 'failed' }
  if (observation.destination !== config.vaultWallet)
    return { ok: false, reason: 'wrong_destination' }
  if (observation.asset !== invoice.asset)
    return { ok: false, reason: 'wrong_asset' }
  if (observation.memo !== invoice.memo && observation.memo !== invoice.invoiceId) {
    return { ok: false, reason: 'wrong_memo' }
  }
  if (now > invoice.expiresAt)
    return { ok: false, reason: 'expired' }

  const tolerance = config.amountTolerance ?? 1e-6
  if (observation.amount + tolerance < invoice.amountRequested) {
    return { ok: false, reason: 'insufficient_amount' }
  }

  return { ok: true }
}
