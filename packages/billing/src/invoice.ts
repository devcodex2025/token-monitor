import { randomBytes } from 'node:crypto'

export type BillingPlan = 'turbo' | 'ai' | 'boost' | 'api'
export type PaymentAsset = 'USDC' | 'SOL'

export interface InvoiceConfig {
  vaultWallet: string
  usdcMint: string
  /** SOL/USD snapshot used to price SOL invoices. */
  solUsdPrice: number
  /** Buffer on SOL invoices (PRD FR-C1.3: +2%). */
  solBufferPct?: number
  now?: () => number
  ttlMinutes?: number
  /** Injectable id generator for deterministic tests. */
  invoiceId?: () => string
}

export interface CreateInvoiceInput {
  orgId: string
  plan: BillingPlan
  periodDays: 1 | 3 | 12
  asset: PaymentAsset
  amountUsd: number
  memo?: string
}

export interface Invoice {
  invoiceId: string
  orgId: string
  plan: BillingPlan
  periodDays: 1 | 3 | 12
  asset: PaymentAsset
  amountUsd: number
  amountRequested: number
  memo: string
  solanaPayUrl: string
  expiresAt: number
}

const DEFAULT_TTL_MINUTES = 30

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}

/**
 * Builds a Solana Pay invoice (FR-C1). USDC uses the SPL mint; SOL is priced from the
 * Pyth snapshot with the +2% buffer baked into amountRequested.
 */
export function createInvoice(input: CreateInvoiceInput, config: InvoiceConfig): Invoice {
  if (input.amountUsd <= 0)
    throw new Error('amountUsd must be greater than zero')
  if (config.solUsdPrice <= 0)
    throw new Error('solUsdPrice must be greater than zero')

  const now = config.now?.() ?? Date.now()
  const invoiceId = config.invoiceId?.() ?? `inv_${randomBytes(12).toString('hex')}`
  const memo = input.memo ?? invoiceId
  const buffer = 1 + (config.solBufferPct ?? 2) / 100

  const rawAmount = input.asset === 'USDC'
    ? input.amountUsd
    : (input.amountUsd / config.solUsdPrice) * buffer
  const amountRequested = round(rawAmount, input.asset === 'USDC' ? 6 : 9)

  const params = new URLSearchParams()
  params.set('amount', amountRequested.toString())
  if (input.asset === 'USDC')
    params.set('spl-token', config.usdcMint)
  params.set('memo', memo)
  params.set('label', 'Token Monitor')
  params.set('message', `${input.plan} ${input.periodDays}d`)

  return {
    invoiceId,
    orgId: input.orgId,
    plan: input.plan,
    periodDays: input.periodDays,
    asset: input.asset,
    amountUsd: input.amountUsd,
    amountRequested,
    memo,
    solanaPayUrl: `solana:${config.vaultWallet}?${params.toString()}`,
    expiresAt: now + (config.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60 * 1000,
  }
}
