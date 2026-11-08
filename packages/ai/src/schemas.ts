import { z } from 'zod'

function wordLimit(maxWords: number) {
  return z.string().refine(
    (value) => {
      const words = value.trim().split(/\s+/).filter(Boolean)
      return words.length > 0 && words.length <= maxWords
    },
    { message: `must be between 1 and ${maxWords} words` },
  )
}

/**
 * Token Brief structured output (PRD §7.2).
 */
export const TokenBriefSchema = z.object({
  summary: wordLimit(80),
  dev_profile: z.object({
    balance_sol: z.number(),
    sells_pct: z.number().min(0).max(100),
    claims_sol: z.number(),
  }),
  risks: z.array(z.object({ title: z.string().min(1), why: z.string().min(1) })).length(3),
  positives: z.array(z.object({ title: z.string().min(1), why: z.string().min(1) })).length(3),
  verdict: z.enum(['calm', 'chop', 'activity', 'risky']),
})

export type TokenBrief = z.infer<typeof TokenBriefSchema>

/**
 * Alert Explainer structured output: 1-2 sentences, bounded length.
 */
export const AlertExplainerSchema = z.object({
  text: wordLimit(80),
})

export type AlertExplainer = z.infer<typeof AlertExplainerSchema>

/**
 * Daily Digest structured output (cron 09:00 UTC, <=200 words).
 */
export const DigestSchema = z.object({
  summary: wordLimit(200),
  highlights: z.array(z.string().min(1)).max(5).default([]),
})

export type Digest = z.infer<typeof DigestSchema>
