import type { TxEvent } from '@tmr/parser'
import type { Rule } from './schema'

export interface RuleContext {
  event: TxEvent
  /** Dev wallet, when known (FR-B5). */
  devWallet?: string | null
  /** Percentage of supply moved by the event (dev_sell). */
  supplyPct?: number | null
  /** Percentage of liquidity removed by the event (lp_remove). */
  liquidityPct?: number | null
  /** Detected bundle for the event's slot (FR-B6). */
  bundle?: { count: number, wallets: string[] } | null
  /** Median 1h volume in SOL used as the spike baseline. */
  medianVolume1hSol?: number | null
}

/**
 * Evaluates a validated rule against an event + derived context.
 * Mirrors the DSL semantics in PRD §6.
 */
export function evaluateRule(rule: Rule, context: RuleContext): boolean {
  const { event } = context

  switch (rule.type) {
    case 'dev_sell':
      return Boolean(context.devWallet)
        && event.type === 'sell'
        && event.wallet === context.devWallet
        && (context.supplyPct ?? 0) >= rule.params.min_pct_supply

    case 'lp_remove':
      return event.type === 'lp_remove'
        && (context.liquidityPct ?? 0) >= rule.params.min_pct_liquidity

    case 'whale_op': {
      const isTrade = event.type === 'buy' || event.type === 'sell'
      const sideMatches = rule.params.side === 'any' || event.type === rule.params.side
      return isTrade && sideMatches && event.sol_amount >= rule.params.min_sol
    }

    case 'bundle':
      return (context.bundle?.count ?? 0) >= rule.params.min_wallets

    case 'claim_fees':
      return event.type === 'claim_fees' && event.sol_amount >= rule.params.min_sol

    case 'volume_spike': {
      const median = context.medianVolume1hSol ?? 0
      if (median <= 0)
        return false
      return event.sol_amount >= median * rule.params.x_median_1h
    }

    default:
      return false
  }
}
