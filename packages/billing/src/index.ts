/**
 * Solana Pay billing (PRD §2.3 / FR-C1). Implementation lands in M2.1; scaffolded in M0.1.
 * Crypto-only: USDC SPL (memo = invoice_id) or SOL priced via Pyth at invoice time +2% buffer.
 */
export type BillingPlan = 'turbo' | 'ai' | 'boost' | 'api'

export type PaymentAsset = 'USDC' | 'SOL'

export type PaymentStatus = 'pending' | 'paid' | 'expired'

export interface InvoiceDraft {
  orgId: string
  plan: BillingPlan
  periodDays: 1 | 3 | 12
  asset: PaymentAsset
  amountRequested: number
  memo: string
}
