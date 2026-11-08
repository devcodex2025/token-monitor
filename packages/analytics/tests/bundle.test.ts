import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { detectBundles, fundingResolverFromRecord } from '../src/bundle'

function buy(wallet: string, slot: number | undefined, sol = 1): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Test',
    slot,
    block_time: 1_760_000_000,
    wallet,
    sol_amount: sol,
    token_amount: 100,
  }
}

describe('bundle metric (FR-B6)', () => {
  it('detects 3+ wallets in one slot sharing a funding parent', () => {
    const events = [
      buy('a', 10, 1),
      buy('b', 10, 2),
      buy('c', 10, 3),
    ]
    const bundles = detectBundles(events, fundingResolverFromRecord({
      a: 'parent-1',
      b: 'parent-1',
      c: 'parent-1',
    }))

    expect(bundles).toEqual([{
      slot: 10,
      mint: 'MINT',
      fundingParent: 'parent-1',
      wallets: ['a', 'b', 'c'],
      count: 3,
      solTotal: 6,
    }])
  })

  it('does not flag 2 wallets', () => {
    const events = [buy('a', 10), buy('b', 10)]
    expect(detectBundles(events, fundingResolverFromRecord({ a: 'p', b: 'p' }))).toEqual([])
  })

  it('does not merge different funding parents', () => {
    const events = [buy('a', 10), buy('b', 10), buy('c', 10), buy('d', 10)]
    const bundles = detectBundles(events, fundingResolverFromRecord({
      a: 'p1',
      b: 'p2',
      c: 'p3',
      d: 'p4',
    }))
    expect(bundles).toEqual([])
  })

  it('counts distinct wallets, not events', () => {
    const events = [buy('a', 10), buy('a', 10), buy('b', 10)]
    expect(detectBundles(events, fundingResolverFromRecord({ a: 'p', b: 'p' }))).toEqual([])
  })

  it('ignores sells, events without a slot and unknown funding parents', () => {
    const events = [
      buy('a', 10),
      buy('b', 10),
      { ...buy('c', 10), type: 'sell' as const },
      buy('d', undefined),
    ]
    expect(detectBundles(events, fundingResolverFromRecord({ a: 'p', b: 'p', d: 'p' }))).toEqual([])
  })

  it('sorts bundles by slot', () => {
    const events = [buy('a', 20), buy('b', 20), buy('c', 20), buy('x', 5), buy('y', 5), buy('z', 5)]
    const bundles = detectBundles(events, fundingResolverFromRecord({
      a: 'p', b: 'p', c: 'p', x: 'q', y: 'q', z: 'q',
    }))
    expect(bundles.map(bundle => bundle.slot)).toEqual([5, 20])
  })
})
