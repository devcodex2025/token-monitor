import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { buildHolderPnl, buildLiquidityDepth, buildNetFlowHourly } from '../src/advanced'

const NOW_MS = Date.UTC(2026, 10, 9, 12, 0, 0)
const NOW_SEC = Math.floor(NOW_MS / 1000)

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Test',
    block_time: NOW_SEC - 60,
    wallet: 'w',
    sol_amount: 1,
    token_amount: 100,
    ...partial,
  }
}

describe('holder PnL (FR-D4)', () => {
  it('computes realized and unrealized PnL per wallet', () => {
    const rows = buildHolderPnl([
      event({ wallet: 'a', type: 'buy', sol_amount: 10, token_amount: 1000 }),
      event({ wallet: 'a', type: 'sell', sol_amount: 7, token_amount: 500 }),
    ], 0.02)

    const row = rows[0]!
    expect(row.wallet).toBe('a')
    expect(row.avgBuyPriceSol).toBe(0.01)
    expect(row.remainingToken).toBe(500)
    expect(row.realizedPnlSol).toBe(2) // 7 - 500*0.01
    expect(row.unrealizedPnlSol).toBe(5) // 500*(0.02-0.01)
    expect(row.totalPnlSol).toBe(7)
  })

  it('sorts by buy SOL and caps at 20 wallets', () => {
    const events = Array.from({ length: 25 }, (_, index) =>
      event({ wallet: `w${index}`, sol_amount: index + 1, token_amount: 100 }))
    const rows = buildHolderPnl(events, 0.02)

    expect(rows).toHaveLength(20)
    expect(rows[0]!.wallet).toBe('w24')
  })

  it('ignores non-trade events', () => {
    const rows = buildHolderPnl([event({ type: 'lp_add' }), event({ type: 'transfer' })], 1)
    expect(rows).toEqual([])
  })
})

describe('hourly net flow (FR-D4)', () => {
  it('buckets buys minus sells per hour over 24h', () => {
    const buckets = buildNetFlowHourly([
      event({ type: 'buy', sol_amount: 5, block_time: NOW_SEC - 30 }),
      event({ type: 'sell', sol_amount: 2, block_time: NOW_SEC - 40 }),
    ], NOW_MS, 24)

    expect(buckets).toHaveLength(24)
    expect(buckets.reduce((sum, bucket) => sum + bucket.netFlowSol, 0)).toBe(3)
  })
})

describe('liquidity depth (FR-D4)', () => {
  it('tracks lp_add minus lp_remove history', () => {
    const depth = buildLiquidityDepth([
      event({ type: 'lp_add', sol_amount: 10, block_time: 100 }),
      event({ type: 'lp_add', sol_amount: 5, block_time: 200 }),
      event({ type: 'lp_remove', sol_amount: 3, block_time: 300 }),
    ])

    expect(depth.currentDepthSol).toBe(12)
    expect(depth.series).toEqual([
      { t: 100, depthSol: 10 },
      { t: 200, depthSol: 15 },
      { t: 300, depthSol: 12 },
    ])
  })
})
