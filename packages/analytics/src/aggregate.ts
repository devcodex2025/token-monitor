import type { TxEvent } from '@tmr/parser'

export type DevPulse = 'green' | 'yellow' | 'red'
export type LpStatus = 'active' | 'removed' | 'unknown'

export interface PricePoint {
  t: number
  price: number
}

export interface TokenSnapshot {
  mint: string
  volume24hSol: number
  volume7dSol: number
  buys24h: number
  sells24h: number
  uniqueWallets24h: number
  netFlow24hSol: number
  lpStatus: LpStatus
  devPulse: DevPulse
  vwap5mSol: number | null
  priceSeries: PricePoint[]
  recent: TxEvent[]
}

export interface AggregateOptions {
  now?: number
  devWallet?: string | null
}

function isTrade(event: TxEvent): boolean {
  return event.type === 'buy' || event.type === 'sell'
}

/**
 * Derives the FR-B3 page aggregates from a token's events.
 * Window comparisons are in seconds because TxEvent.block_time is unix seconds.
 */
export function aggregateTokenEvents(
  mint: string,
  events: TxEvent[],
  options: AggregateOptions = {},
): TokenSnapshot {
  const nowMs = options.now ?? Date.now()
  const nowSec = Math.floor(nowMs / 1000)
  const dayAgo = nowSec - 86_400
  const weekAgo = nowSec - 7 * 86_400
  const fiveMinAgo = nowMs - 5 * 60 * 1000

  const sorted = [...events].sort((a, b) => a.block_time - b.block_time)
  const trades = sorted.filter(isTrade)

  const in24h = trades.filter(event => event.block_time >= dayAgo)
  const in7d = trades.filter(event => event.block_time >= weekAgo)

  const volume24hSol = in24h.reduce((sum, event) => sum + event.sol_amount, 0)
  const volume7dSol = in7d.reduce((sum, event) => sum + event.sol_amount, 0)
  const buySol = in24h.filter(event => event.type === 'buy').reduce((sum, event) => sum + event.sol_amount, 0)
  const sellSol = in24h.filter(event => event.type === 'sell').reduce((sum, event) => sum + event.sol_amount, 0)

  const lastLiquidityEvent = [...sorted]
    .reverse()
    .find(event => event.type === 'lp_add' || event.type === 'lp_remove')

  const lpStatus: LpStatus = lastLiquidityEvent
    ? (lastLiquidityEvent.type === 'lp_remove' ? 'removed' : 'active')
    : 'unknown'

  let devPulse: DevPulse = 'yellow'
  if (options.devWallet) {
    const devEvents = sorted.filter(event => event.wallet === options.devWallet)
    if (devEvents.some(event => event.type === 'sell'))
      devPulse = 'red'
    else if (devEvents.some(event => event.type === 'buy'))
      devPulse = 'green'
  }

  const fiveMinEvents = sorted.filter(
    event => isTrade(event) && event.block_time * 1000 >= fiveMinAgo && event.token_amount > 0,
  )
  const vwap5mSol = fiveMinEvents.length > 0
    ? fiveMinEvents.reduce((sum, event) => sum + event.sol_amount, 0)
    / fiveMinEvents.reduce((sum, event) => sum + event.token_amount, 0)
    : null

  const priceSeries: PricePoint[] = sorted
    .filter(event => typeof event.price_at_tx === 'number' && event.price_at_tx > 0)
    .map(event => ({ t: event.block_time, price: event.price_at_tx! }))
    .slice(-200)

  const uniqueWallets24h = new Set(
    trades.filter(event => event.block_time >= dayAgo).map(event => event.wallet),
  ).size

  return {
    mint,
    volume24hSol,
    volume7dSol,
    buys24h: in24h.filter(event => event.type === 'buy').length,
    sells24h: in24h.filter(event => event.type === 'sell').length,
    uniqueWallets24h,
    netFlow24hSol: buySol - sellSol,
    lpStatus,
    devPulse,
    vwap5mSol,
    priceSeries,
    recent: [...sorted].reverse().slice(0, 20),
  }
}
