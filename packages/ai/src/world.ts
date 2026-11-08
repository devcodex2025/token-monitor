import type { PricePoint } from '@tmr/analytics'
import type { TxEvent } from '@tmr/parser'
import { aggregateTokenEvents, detectBundles } from '@tmr/analytics'

export interface TokenMeta {
  mint: string
  symbol?: string
  name?: string
  decimals?: number
  logoUri?: string
}

export interface HolderShare {
  wallet: string
  pct: number
}

export interface BuildTokenWorldInput {
  meta: TokenMeta
  events: TxEvent[]
  holders?: HolderShare[]
  devWallet?: string | null
  /** Custom socials for Boost tokens (PRD §7.1). */
  socials?: Record<string, string>
  /** One-hop funding parents for bundle detection. */
  fundingParents?: Record<string, string | null | undefined>
  now?: number
}

export interface DevProfile {
  balanceSol: number | null
  sellsPct: number
  claimsSol: number
  ageSeconds: number | null
}

export interface TokenWorld {
  meta: TokenMeta
  priceSeries: PricePoint[]
  events: TxEvent[]
  holders: HolderShare[]
  devWallet: string | null
  devProfile: DevProfile
  lpStatus: string
  bundleCount24h: number
  socials: Record<string, string>
}

/**
 * Builds the single AI context snapshot (PRD §7.1): meta, 24h price series, last 200 events,
 * top-20 holders, dev profile, LP status, bundle count and socials.
 */
export function buildTokenWorld(input: BuildTokenWorldInput): TokenWorld {
  const now = input.now ?? Date.now()
  const sorted = [...input.events].sort((a, b) => a.block_time - b.block_time)
  const recent = sorted.slice(-200)
  const aggregate = aggregateTokenEvents(input.meta.mint, sorted, { now })

  const devWallet = input.devWallet ?? null
  const devEvents = devWallet ? sorted.filter(event => event.wallet === devWallet) : []
  const totalSellToken = sorted
    .filter(event => event.type === 'sell')
    .reduce((sum, event) => sum + event.token_amount, 0)
  const devSellToken = devEvents
    .filter(event => event.type === 'sell')
    .reduce((sum, event) => sum + event.token_amount, 0)
  const claimsSol = devEvents
    .filter(event => event.type === 'claim_fees')
    .reduce((sum, event) => sum + event.sol_amount, 0)

  const firstEvent = sorted[0]
  const ageSeconds = firstEvent ? Math.max(0, Math.floor(now / 1000) - firstEvent.block_time) : null

  const dayAgoSec = Math.floor(now / 1000) - 86_400
  const events24h = sorted.filter(event => event.block_time >= dayAgoSec)
  const fundingParents = input.fundingParents ?? {}
  const bundles24h = detectBundles(events24h, wallet => fundingParents[wallet] ?? null)

  return {
    meta: input.meta,
    priceSeries: aggregate.priceSeries,
    events: recent,
    holders: (input.holders ?? []).slice(0, 20),
    devWallet,
    devProfile: {
      balanceSol: null,
      sellsPct: totalSellToken > 0 ? (devSellToken / totalSellToken) * 100 : 0,
      claimsSol,
      ageSeconds,
    },
    lpStatus: aggregate.lpStatus,
    bundleCount24h: bundles24h.length,
    socials: input.socials ?? {},
  }
}
