/**
 * Rules DSL v1 (PRD §6). Implementation lands in M2.4; this package is scaffolded in M0.1.
 */
export const RULES_DSL_VERSION = 1

export type RuleType
  = | 'dev_sell'
    | 'lp_remove'
    | 'whale_op'
    | 'bundle'
    | 'claim_fees'
    | 'volume_spike'

export interface RuleDefinition {
  v: typeof RULES_DSL_VERSION
  type: RuleType
  params: Record<string, number | string>
}
