import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { deriveWalletStats, detectDevWallet } from '../src/wallet-stats'

const NOW = 1_760_000_000

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Test',
    block_time: NOW,
    wallet: 'wallet-1',
    sol_amount: 1,
    token_amount: 100,
    ...partial,
  }
}

describe('wallet stats + dev detect (FR-B5)', () => {
  it('detects the dev wallet from mint_created', () => {
    const dev = detectDevWallet([
      event({ type: 'buy', wallet: 'buyer', block_time: NOW - 10 }),
      event({ type: 'mint_created', wallet: 'creator', block_time: NOW - 20 }),
    ])
    expect(dev).toBe('creator')
  })

  it('falls back to the earliest buyer when creation is absent', () => {
    const dev = detectDevWallet([
      event({ wallet: 'later', block_time: NOW - 5 }),
      event({ wallet: 'earlier', block_time: NOW - 50 }),
    ])
    expect(dev).toBe('earlier')
  })

  it('aggregates buy/sell totals and first/last seen', () => {
    const stats = deriveWalletStats([
      event({ type: 'buy', wallet: 'w', sol_amount: 2, token_amount: 200, block_time: NOW - 100 }),
      event({ type: 'sell', wallet: 'w', sol_amount: 3, token_amount: 150, block_time: NOW - 50 }),
      event({ type: 'buy', wallet: 'w', sol_amount: 1, token_amount: 100, block_time: NOW }),
    ], { devWallet: null })

    const aggregate = stats.get('w')!
    expect(aggregate.buySol).toBe(3)
    expect(aggregate.sellSol).toBe(3)
    expect(aggregate.buyToken).toBe(300)
    expect(aggregate.sellToken).toBe(150)
    expect(aggregate.firstSeen).toBe(NOW - 100)
    expect(aggregate.lastSeen).toBe(NOW)
  })

  it('tags dev wallets', () => {
    const stats = deriveWalletStats([
      event({ wallet: 'dev', type: 'mint_created' }),
      event({ wallet: 'dev', type: 'buy' }),
    ], { devWallet: 'dev' })
    expect(stats.get('dev')!.tags).toContain('dev')
  })

  it('tags whales by traded SOL threshold', () => {
    const stats = deriveWalletStats([
      event({ wallet: 'whale', sol_amount: 40 }),
      event({ wallet: 'whale', type: 'sell', sol_amount: 20 }),
      event({ wallet: 'small', sol_amount: 1 }),
    ], { devWallet: null, whaleThresholdSol: 50 })

    expect(stats.get('whale')!.tags).toContain('whale')
    expect(stats.get('small')!.tags).not.toContain('whale')
  })

  it('tags bundlers and records funding parents', () => {
    const stats = deriveWalletStats([
      event({ wallet: 'a' }),
      event({ wallet: 'b' }),
    ], {
      devWallet: null,
      bundledWallets: ['a'],
      fundingParents: { a: 'parent', b: 'parent' },
    })

    expect(stats.get('a')!.tags).toContain('bundler')
    expect(stats.get('b')!.tags).not.toContain('bundler')
    expect(stats.get('a')!.fundingParent).toBe('parent')
  })
})
