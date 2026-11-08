import type { Invoice } from './invoice'
import type { PaymentObservation } from './verify'
import { verifyPayment } from './verify'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Extends prepaid access from max(now, current prepaid_until) (FR-C1).
 */
export function extendPrepaidUntil(
  current: Date | string | null,
  periodDays: number,
  now: Date = new Date(),
): Date {
  const currentDate = current ? new Date(current) : null
  const base = currentDate && currentDate.getTime() > now.getTime() ? currentDate : now
  return new Date(base.getTime() + periodDays * DAY_MS)
}

export interface ApplyPaymentInput {
  invoice: Invoice
  observation: PaymentObservation
  currentPrepaidUntil: Date | string | null
  /** Signatures already applied (DB tx_signature uniqueness). */
  processedSignatures: ReadonlySet<string>
  vaultWallet: string
  now?: Date
}

export type ApplyPaymentResult
  = | { status: 'applied', prepaidUntil: Date }
    | { status: 'duplicate' }
    | { status: 'rejected', reason: string }

/**
 * Applies a verified payment exactly once. A second payment of the same invoice with a
 * different signature extends prepaid access instead of failing (AC-C1.2).
 */
export function applyPayment(input: ApplyPaymentInput): ApplyPaymentResult {
  const now = input.now ?? new Date()

  if (input.processedSignatures.has(input.observation.signature)) {
    return { status: 'duplicate' }
  }

  const verification = verifyPayment(input.observation, input.invoice, {
    vaultWallet: input.vaultWallet,
  }, now.getTime())

  if (!verification.ok) {
    return { status: 'rejected', reason: verification.reason }
  }

  return {
    status: 'applied',
    prepaidUntil: extendPrepaidUntil(input.currentPrepaidUntil, input.invoice.periodDays, now),
  }
}
