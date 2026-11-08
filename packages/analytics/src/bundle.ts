import type { TxEvent } from '@tmr/parser'

export interface BundleGroup {
  slot: number
  mint: string
  fundingParent: string
  wallets: string[]
  count: number
  solTotal: number
}

/** Resolves a wallet's one-hop funding parent (or null when unknown). */
export type FundingResolver = (wallet: string) => string | null

/**
 * Detects coordinated buys (FR-B6): at least 3 distinct wallets in the same slot that
 * share the same funding parent.
 */
export function detectBundles(events: TxEvent[], resolveFundingParent: FundingResolver): BundleGroup[] {
  const buysBySlot = new Map<number, TxEvent[]>()

  for (const event of events) {
    if (event.type !== 'buy' || typeof event.slot !== 'number')
      continue
    const list = buysBySlot.get(event.slot) ?? []
    list.push(event)
    buysBySlot.set(event.slot, list)
  }

  const bundles: BundleGroup[] = []

  for (const [slot, buys] of buysBySlot) {
    const buysByParent = new Map<string, TxEvent[]>()

    for (const buy of buys) {
      const parent = resolveFundingParent(buy.wallet)
      if (!parent)
        continue
      const list = buysByParent.get(parent) ?? []
      list.push(buy)
      buysByParent.set(parent, list)
    }

    for (const [fundingParent, parentBuys] of buysByParent) {
      const wallets = [...new Set(parentBuys.map(buy => buy.wallet))]
      if (wallets.length < 3)
        continue

      bundles.push({
        slot,
        mint: parentBuys[0]!.mint,
        fundingParent,
        wallets,
        count: wallets.length,
        solTotal: parentBuys.reduce((sum, buy) => sum + buy.sol_amount, 0),
      })
    }
  }

  return bundles.sort((a, b) => a.slot - b.slot)
}

/**
 * Convenience resolver backed by a wallet -> funding parent record.
 */
export function fundingResolverFromRecord(
  record: Record<string, string | null | undefined>,
): FundingResolver {
  return wallet => record[wallet] ?? null
}
