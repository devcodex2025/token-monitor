import type { HeliusTransaction } from './types'

const STABLE_MINTS = new Set([
  'So11111111111111111111111111111111111111112', // WSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
])

/**
 * Returns the non-stable token mints involved in a Helius transaction, in discovery order.
 * Used by the worker to pick the monitored mint when a webhook is not scoped to one address.
 */
export function inferMints(tx: HeliusTransaction): string[] {
  const seen = new Set<string>()
  const mints: string[] = []

  const push = (mint: string | undefined): void => {
    if (!mint || STABLE_MINTS.has(mint) || seen.has(mint))
      return
    seen.add(mint)
    mints.push(mint)
  }

  for (const transfer of tx.tokenTransfers ?? []) push(transfer.mint)
  for (const account of tx.accountData ?? []) {
    for (const change of account.tokenBalanceChanges ?? []) push(change.mint)
  }

  return mints
}
