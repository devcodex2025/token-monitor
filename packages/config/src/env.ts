import { z } from 'zod'

/**
 * PRD §8 environment contract. Secrets stay in env; nothing is hardcoded.
 * Optional values are legitimately absent in local/free-path mode.
 */
export const envSchema = z.object({
  // App
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_RPC_FALLBACKS: z.string().optional(),

  // Infrastructure
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Solana data
  HELIUS_API_KEY: z.string().optional(),
  HELIUS_WEBHOOK_SECRET: z.string().optional(),
  PYTH_HERMES_URL: z.string().url().default('https://hermes.pyth.network'),

  // Billing
  VAULT_WALLET_ADDRESS: z.string().optional(),
  USDC_MINT_ADDRESS: z.string().default('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  TMR_TOKEN_MINT: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // AI
  AI_API_KEY: z.string().optional(),
  AI_MODEL_BRIEF: z.string().optional(),
  AI_MODEL_EXPLAINER: z.string().optional(),
  AI_MODEL_CHAT: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export class EnvValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid environment variables:\n${issues.join('\n')}`)
    this.name = 'EnvValidationError'
    this.issues = issues
  }
}

/**
 * Parses and validates environment variables. Throws EnvValidationError with readable issues.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    throw new EnvValidationError(issues)
  }
  return result.data
}
