import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { aggregateTokenEvents } from '../src/aggregate'

const NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0)
const NOW_SEC = Math.floor(NOW_MS / 1000)
const DAY = 86_400

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Test',
    block_time: NOW_SEC - 60,
    wallet: 'wallet-1',
    sol_amount: 1,
    token_amount: 100,
    ...partial,
  }
}

describe('aggregateTokenEvents (FR-B3)', () => {
  it('computes 24h and 7d trade volume', () => {
    const snapshot = aggregateTokenEvents('MINT', [
      event({ type: 'buy', sol_amount: 2 }),
      event({ type: 'sell', sol_amount: 3 }),
      event({ type: 'buy', sol_amount: 10, block_time: NOW_SEC - 3 * DAY }),
    ], { now: NOW_MS })

    expect(snapshot.volume24hSol).toBe(5)
    expect(snapshot.volume7dSol).toBe(15)
    expect(snapshot.buys24h).toBe(1)
    expect(snapshot.sells24h).toBe(1)
  })

  it('counts unique wallets and net flow over 24h', () => {
    const snapshot = aggregateTokenEvents('MINT', [
      event({ type: 'buy', wallet: 'a', sol_amount: 4 }),
      event({ type: 'buy', wallet: 'b', sol_amount: 1 }),
      event({ type: 'sell', wallet: 'a', sol_amount: 2 }),
    ], { now: NOW_MS })

    expect(snapshot.uniqueWallets24h).toBe(2)
    expect(snapshot.netFlow24hSol).toBe(3)
  })

  it('derives LP status from the last liquidity event', () => {
    expect(aggregateTokenEvents('MINT', [
      event({ type: 'lp_add', block_time: NOW_SEC - 100 }),
      event({ type: 'lp_remove', block_time: NOW_SEC - 50 }),
    ], { now: NOW_MS }).lpStatus).toBe('removed')

    expect(aggregateTokenEvents('MINT', [
      event({ type: 'lp_remove', block_time: NOW_SEC - 100 }),
      event({ type: 'lp_add', block_time: NOW_SEC - 50 }),
    ], { now: NOW_MS }).lpStatus).toBe('active')

    expect(aggregateTokenEvents('MINT', [], { now: NOW_MS }).lpStatus).toBe('unknown')
  })

  it('derives the dev pulse from dev-wallet behaviour', () => {
    const devWallet = 'dev-wallet'
    expect(aggregateTokenEvents('MINT', [
      event({ wallet: devWallet, type: 'sell' }),
    ], { now: NOW_MS, devWallet }).devPulse).toBe('red')

    expect(aggregateTokenEvents('MINT', [
      event({ wallet: devWallet, type: 'buy' }),
    ], { now: NOW_MS, devWallet }).devPulse).toBe('green')

    expect(aggregateTokenEvents('MINT', [
      event({ wallet: 'someone-else', type: 'buy' }),
    ], { now: NOW_MS, devWallet }).devPulse).toBe('yellow')
  })

  it('computes a 5-minute VWAP', () => {
    const snapshot = aggregateTokenEvents('MINT', [
      event({ sol_amount: 1, token_amount: 100, block_time: NOW_SEC - 60 }),
      event({ sol_amount: 3, token_amount: 100, block_time: NOW_SEC - 120 }),
      event({ sol_amount: 100, token_amount: 100, block_time: NOW_SEC - 10 * 60 }),
    ], { now: NOW_MS })

    expect(snapshot.vwap5mSol).toBeCloseTo(4 / 200, 12)
  })

  it('builds a price series and a newest-first recent feed', () => {
    const snapshot = aggregateTokenEvents('MINT', [
      event({ block_time: NOW_SEC - 30, price_at_tx: 0.002 }),
      event({ block_time: NOW_SEC - 60, price_at_tx: 0.001 }),
      event({ block_time: NOW_SEC - 90 }),
    ], { now: NOW_MS })

    expect(snapshot.priceSeries).toEqual([
      { t: NOW_SEC - 60, price: 0.001 },
      { t: NOW_SEC - 30, price: 0.002 },
    ])
    expect(snapshot.recent.map(e => e.block_time)).toEqual([NOW_SEC - 30, NOW_SEC - 60, NOW_SEC - 90])
  })
})
