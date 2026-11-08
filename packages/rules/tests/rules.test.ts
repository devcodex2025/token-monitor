import type { TxEvent } from '@tmr/parser'
import type { Rule } from '../src/schema'
import { describe, expect, it } from 'vitest'
import { evaluateRule } from '../src/evaluate'
import { parseRule, RuleSchema, safeParseRule } from '../src/schema'

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'sell',
    dex: 'Test',
    block_time: 1_760_000_000,
    wallet: 'wallet',
    sol_amount: 10,
    token_amount: 100,
    ...partial,
  }
}

describe('Rules DSL schema (PRD §6)', () => {
  const validRules: Rule[] = [
    { v: 1, type: 'dev_sell', params: { min_pct_supply: 1 } },
    { v: 1, type: 'lp_remove', params: { min_pct_liquidity: 90 } },
    { v: 1, type: 'whale_op', params: { min_sol: 50, side: 'any' } },
    { v: 1, type: 'bundle', params: { min_wallets: 3 } },
    { v: 1, type: 'claim_fees', params: { min_sol: 10 } },
    { v: 1, type: 'volume_spike', params: { x_median_1h: 5 } },
  ]

  it('accepts every DSL v1 rule type', () => {
    for (const rule of validRules) {
      expect(parseRule(rule)).toEqual(rule)
    }
  })

  it('defaults whale_op.side to any', () => {
    const parsed = parseRule({ v: 1, type: 'whale_op', params: { min_sol: 5 } })
    expect(parsed).toEqual({ v: 1, type: 'whale_op', params: { min_sol: 5, side: 'any' } })
  })

  it('rejects unknown types and invalid params', () => {
    expect(safeParseRule({ v: 1, type: 'sniper', params: {} }).success).toBe(false)
    expect(safeParseRule({ v: 1, type: 'bundle', params: { min_wallets: 1 } }).success).toBe(false)
    expect(safeParseRule({ v: 2, type: 'bundle', params: { min_wallets: 3 } }).success).toBe(false)
    expect(safeParseRule({ v: 1, type: 'whale_op', params: { min_sol: -1 } }).success).toBe(false)
  })

  it('exposes a discriminated union', () => {
    expect(RuleSchema.options).toHaveLength(6)
  })
})

describe('evaluateRule (PRD §6)', () => {
  it('dev_sell: fires for the dev wallet above the supply threshold', () => {
    const rule = parseRule({ v: 1, type: 'dev_sell', params: { min_pct_supply: 1 } })

    expect(evaluateRule(rule, { event: event({ wallet: 'dev' }), devWallet: 'dev', supplyPct: 1.5 })).toBe(true)
    expect(evaluateRule(rule, { event: event({ wallet: 'dev' }), devWallet: 'dev', supplyPct: 1 })).toBe(true)
    expect(evaluateRule(rule, { event: event({ wallet: 'dev' }), devWallet: 'dev', supplyPct: 0.9 })).toBe(false)
    expect(evaluateRule(rule, { event: event({ wallet: 'retail' }), devWallet: 'dev', supplyPct: 5 })).toBe(false)
    expect(evaluateRule(rule, { event: event({ type: 'buy', wallet: 'dev' }), devWallet: 'dev', supplyPct: 5 })).toBe(false)
  })

  it('lp_remove: fires at or above the liquidity threshold', () => {
    const rule = parseRule({ v: 1, type: 'lp_remove', params: { min_pct_liquidity: 90 } })

    expect(evaluateRule(rule, { event: event({ type: 'lp_remove' }), liquidityPct: 90 })).toBe(true)
    expect(evaluateRule(rule, { event: event({ type: 'lp_remove' }), liquidityPct: 89 })).toBe(false)
    expect(evaluateRule(rule, { event: event({ type: 'sell' }), liquidityPct: 100 })).toBe(false)
  })

  it('whale_op: respects min_sol and side', () => {
    const anySide = parseRule({ v: 1, type: 'whale_op', params: { min_sol: 50, side: 'any' } })
    const buyOnly = parseRule({ v: 1, type: 'whale_op', params: { min_sol: 50, side: 'buy' } })

    expect(evaluateRule(anySide, { event: event({ type: 'buy', sol_amount: 50 }) })).toBe(true)
    expect(evaluateRule(anySide, { event: event({ type: 'sell', sol_amount: 50 }) })).toBe(true)
    expect(evaluateRule(anySide, { event: event({ type: 'buy', sol_amount: 49.99 }) })).toBe(false)
    expect(evaluateRule(buyOnly, { event: event({ type: 'sell', sol_amount: 100 }) })).toBe(false)
  })

  it('bundle: fires at or above min_wallets', () => {
    const rule = parseRule({ v: 1, type: 'bundle', params: { min_wallets: 3 } })

    expect(evaluateRule(rule, { event: event(), bundle: { count: 3, wallets: ['a', 'b', 'c'] } })).toBe(true)
    expect(evaluateRule(rule, { event: event(), bundle: { count: 2, wallets: ['a', 'b'] } })).toBe(false)
    expect(evaluateRule(rule, { event: event(), bundle: null })).toBe(false)
  })

  it('claim_fees: fires at or above min_sol', () => {
    const rule = parseRule({ v: 1, type: 'claim_fees', params: { min_sol: 10 } })

    expect(evaluateRule(rule, { event: event({ type: 'claim_fees', sol_amount: 10 }) })).toBe(true)
    expect(evaluateRule(rule, { event: event({ type: 'claim_fees', sol_amount: 9.99 }) })).toBe(false)
    expect(evaluateRule(rule, { event: event({ type: 'sell', sol_amount: 100 }) })).toBe(false)
  })

  it('volume_spike: compares against the median baseline', () => {
    const rule = parseRule({ v: 1, type: 'volume_spike', params: { x_median_1h: 5 } })

    expect(evaluateRule(rule, { event: event({ sol_amount: 50 }), medianVolume1hSol: 10 })).toBe(true)
    expect(evaluateRule(rule, { event: event({ sol_amount: 49 }), medianVolume1hSol: 10 })).toBe(false)
    expect(evaluateRule(rule, { event: event({ sol_amount: 50 }), medianVolume1hSol: 0 })).toBe(false)
    expect(evaluateRule(rule, { event: event({ sol_amount: 50 }), medianVolume1hSol: null })).toBe(false)
  })
})
