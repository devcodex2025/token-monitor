import { z } from 'zod'

/**
 * Rules DSL v1 (PRD §6). This schema is the single validator used by both the UI
 * (client preview) and the worker (evaluation).
 */
export const RuleSchema = z.discriminatedUnion('type', [
  z.object({
    v: z.literal(1),
    type: z.literal('dev_sell'),
    params: z.object({ min_pct_supply: z.number().positive().max(100) }),
  }),
  z.object({
    v: z.literal(1),
    type: z.literal('lp_remove'),
    params: z.object({ min_pct_liquidity: z.number().min(0).max(100) }),
  }),
  z.object({
    v: z.literal(1),
    type: z.literal('whale_op'),
    params: z.object({
      min_sol: z.number().positive(),
      side: z.enum(['buy', 'sell', 'any']).default('any'),
    }),
  }),
  z.object({
    v: z.literal(1),
    type: z.literal('bundle'),
    params: z.object({ min_wallets: z.number().int().min(2) }),
  }),
  z.object({
    v: z.literal(1),
    type: z.literal('claim_fees'),
    params: z.object({ min_sol: z.number().positive() }),
  }),
  z.object({
    v: z.literal(1),
    type: z.literal('volume_spike'),
    params: z.object({ x_median_1h: z.number().positive() }),
  }),
])

export type Rule = z.infer<typeof RuleSchema>
export type RuleType = Rule['type']

export function parseRule(input: unknown): Rule {
  return RuleSchema.parse(input)
}

export function safeParseRule(input: unknown) {
  return RuleSchema.safeParse(input)
}
