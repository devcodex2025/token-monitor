import type { TxEvent } from '@tmr/parser'

export type WalletTag = 'dev' | 'whale' | 'bundler'

export interface WalletAggregate {
  wallet: string
  firstSeen: number
  lastSeen: number
  fundingParent: string | null
  buySol: number
  sellSol: number
  buyToken: number
  sellToken: number
  tags: WalletTag[]
}

export interface WalletStatsOptions {
  /** Explicit dev wallet; otherwise inferred with detectDevWallet(). */
  devWallet?: string | null
  /** Whale threshold in SOL (total traded volume). Default 50. */
  whaleThresholdSol?: number
  /** Wallets participating in a detected bundle. */
  bundledWallets?: Iterable<string>
  /** One-hop funding parent per wallet (from the first transfer-in). */
  fundingParents?: Record<string, string | null | undefined>
}

/**
 * Dev wallet detection (FR-B5): creator from a `mint_created` event.
 * Fallback (PRD: top owner, approximated here) is the earliest buyer when creation
 * is not present in the event window.
 */
export function detectDevWallet(events: TxEvent[]): string | null {
  const created = events
    .filter(event => event.type === 'mint_created')
    .sort((a, b) => a.block_time - b.block_time)[0]
  if (created)
    return created.wallet

  const firstBuy = events
    .filter(event => event.type === 'buy')
    .sort((a, b) => a.block_time - b.block_time)[0]

  return firstBuy?.wallet ?? null
}

/**
 * Derives per-wallet aggregates and tags (dev / whale / bundler) from token events.
 */
export function deriveWalletStats(
  events: TxEvent[],
  options: WalletStatsOptions = {},
): Map<string, WalletAggregate> {
  const devWallet = options.devWallet ?? detectDevWallet(events)
  const whaleThreshold = options.whaleThresholdSol ?? 50
  const bundled = new Set(options.bundledWallets ?? [])
  const fundingParents = options.fundingParents ?? {}

  const aggregates = new Map<string, WalletAggregate>()

  for (const event of events) {
    if (!event.wallet)
      continue

    const aggregate = aggregates.get(event.wallet) ?? {
      wallet: event.wallet,
      firstSeen: event.block_time,
      lastSeen: event.block_time,
      fundingParent: fundingParents[event.wallet] ?? null,
      buySol: 0,
      sellSol: 0,
      buyToken: 0,
      sellToken: 0,
      tags: [],
    }

    aggregate.firstSeen = Math.min(aggregate.firstSeen, event.block_time)
    aggregate.lastSeen = Math.max(aggregate.lastSeen, event.block_time)

    if (event.type === 'buy') {
      aggregate.buySol += event.sol_amount
      aggregate.buyToken += event.token_amount
    }
    else if (event.type === 'sell') {
      aggregate.sellSol += event.sol_amount
      aggregate.sellToken += event.token_amount
    }

    aggregates.set(event.wallet, aggregate)
  }

  for (const aggregate of aggregates.values()) {
    const tags = new Set<WalletTag>()
    if (devWallet && aggregate.wallet === devWallet)
      tags.add('dev')
    if (aggregate.buySol + aggregate.sellSol >= whaleThreshold)
      tags.add('whale')
    if (bundled.has(aggregate.wallet))
      tags.add('bundler')
    aggregate.tags = [...tags]
  }

  return aggregates
}
