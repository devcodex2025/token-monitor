import type { TxEvent } from '@tmr/parser'

export interface HolderPnl {
  wallet: string
  buySol: number
  buyToken: number
  sellSol: number
  sellToken: number
  avgBuyPriceSol: number
  realizedPnlSol: number
  unrealizedPnlSol: number
  totalPnlSol: number
  remainingToken: number
}

export interface NetFlowBucket {
  hourStart: number
  netFlowSol: number
}

export interface LiquidityPoint {
  t: number
  depthSol: number
}

export interface LiquidityDepth {
  currentDepthSol: number
  series: LiquidityPoint[]
}

/**
 * Holder PnL table (FR-D4): top-20 wallets by buy SOL, with realized and unrealized PnL
 * at the supplied current price (SOL per token).
 */
export function buildHolderPnl(
  events: TxEvent[],
  currentPriceSol: number,
  limit = 20,
): HolderPnl[] {
  const byWallet = new Map<string, HolderPnl>()

  for (const event of events) {
    if (!event.wallet)
      continue
    if (event.type !== 'buy' && event.type !== 'sell')
      continue

    const row = byWallet.get(event.wallet) ?? {
      wallet: event.wallet,
      buySol: 0,
      buyToken: 0,
      sellSol: 0,
      sellToken: 0,
      avgBuyPriceSol: 0,
      realizedPnlSol: 0,
      unrealizedPnlSol: 0,
      totalPnlSol: 0,
      remainingToken: 0,
    }

    if (event.type === 'buy') {
      row.buySol += event.sol_amount
      row.buyToken += event.token_amount
    }
    else {
      row.sellSol += event.sol_amount
      row.sellToken += event.token_amount
    }

    byWallet.set(event.wallet, row)
  }

  const rows: HolderPnl[] = []

  for (const row of byWallet.values()) {
    row.avgBuyPriceSol = row.buyToken > 0 ? row.buySol / row.buyToken : 0
    row.remainingToken = Math.max(0, row.buyToken - row.sellToken)
    const costOfSold = row.sellToken * row.avgBuyPriceSol
    row.realizedPnlSol = row.sellSol - costOfSold
    row.unrealizedPnlSol = row.remainingToken * (currentPriceSol - row.avgBuyPriceSol)
    row.totalPnlSol = row.realizedPnlSol + row.unrealizedPnlSol
    rows.push(row)
  }

  return rows
    .sort((a, b) => b.buySol - a.buySol)
    .slice(0, limit)
}

/**
 * Hourly net flow (FR-D4): buys SOL - sells SOL per hour bucket.
 */
export function buildNetFlowHourly(events: TxEvent[], now: number = Date.now(), hours = 24): NetFlowBucket[] {
  const hourMs = 60 * 60 * 1000
  const currentHour = Math.floor(now / hourMs) * hourMs
  const start = currentHour - (hours - 1) * hourMs

  const buckets = new Map<number, number>()
  for (let index = 0; index < hours; index++) {
    buckets.set(start + index * hourMs, 0)
  }

  for (const event of events) {
    if (event.type !== 'buy' && event.type !== 'sell')
      continue
    const timeMs = event.block_time * 1000
    if (timeMs < start || timeMs > currentHour + hourMs)
      continue

    const bucket = Math.floor(timeMs / hourMs) * hourMs
    const current = buckets.get(bucket)
    if (current === undefined)
      continue

    buckets.set(bucket, current + (event.type === 'buy' ? event.sol_amount : -event.sol_amount))
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hourStart, netFlowSol]) => ({ hourStart, netFlowSol }))
}

/**
 * Liquidity depth (FR-D4): running lp_add - lp_remove history in SOL.
 */
export function buildLiquidityDepth(events: TxEvent[]): LiquidityDepth {
  const sorted = events
    .filter(event => event.type === 'lp_add' || event.type === 'lp_remove')
    .sort((a, b) => a.block_time - b.block_time)

  let depthSol = 0
  const series: LiquidityPoint[] = []

  for (const event of sorted) {
    depthSol += event.type === 'lp_add' ? event.sol_amount : -event.sol_amount
    series.push({ t: event.block_time, depthSol })
  }

  return { currentDepthSol: depthSol, series }
}
