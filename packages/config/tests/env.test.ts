import { describe, expect, it } from 'vitest'
import { EnvValidationError, parseEnv } from '../src/env'

const MINIMAL = {
  DATABASE_URL: 'postgresql://tmr:tmr@localhost:5432/tmr',
  REDIS_URL: 'redis://localhost:6379',
}

describe('env contract (PRD §8 / M0.5)', () => {
  it('parses a minimal local environment and applies defaults', () => {
    const env = parseEnv(MINIMAL)
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
    expect(env.PYTH_HERMES_URL).toBe('https://hermes.pyth.network')
    expect(env.USDC_MINT_ADDRESS).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('keeps optional secrets optional', () => {
    const env = parseEnv(MINIMAL)
    expect(env.HELIUS_API_KEY).toBeUndefined()
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined()
    expect(env.AI_API_KEY).toBeUndefined()
  })

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({ REDIS_URL: MINIMAL.REDIS_URL })).toThrow(EnvValidationError)
  })

  it('rejects malformed URLs', () => {
    expect(() => parseEnv({ ...MINIMAL, DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/)
  })
})
