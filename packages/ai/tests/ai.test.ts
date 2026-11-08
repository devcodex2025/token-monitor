import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { AlertExplainerSchema, DigestSchema, TokenBriefSchema } from '../src/schemas'
import { sanitizeUserText } from '../src/sanitize'
import { buildBriefUserMessage, SYSTEM_PROMPT } from '../src/prompts'
import { buildTokenWorld } from '../src/world'

const NOW_MS = Date.UTC(2026, 10, 9, 12, 0, 0)
const NOW_SEC = Math.floor(NOW_MS / 1000)

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Test',
    block_time: NOW_SEC - 60,
    wallet: 'wallet-1',
    sol_amount: 1,
    token_amount: 100,
    price_at_tx: 0.01,
    ...partial,
  }
}

const validBrief = {
  summary: 'A short factual summary.',
  dev_profile: { balance_sol: 1.5, sells_pct: 12, claims_sol: 4 },
  risks: [
    { title: 'r1', why: 'w1' },
    { title: 'r2', why: 'w2' },
    { title: 'r3', why: 'w3' },
  ],
  positives: [
    { title: 'p1', why: 'w1' },
    { title: 'p2', why: 'w2' },
    { title: 'p3', why: 'w3' },
  ],
  verdict: 'activity',
}

describe('AI structured outputs (FR-E2)', () => {
  it('accepts a valid token brief', () => {
    expect(TokenBriefSchema.parse(validBrief)).toEqual(validBrief)
  })

  it('rejects summaries over 80 words', () => {
    const words = Array.from({ length: 81 }, (_, index) => `w${index}`).join(' ')
    expect(TokenBriefSchema.safeParse({ ...validBrief, summary: words }).success).toBe(false)
  })

  it('requires exactly 3 risks and 3 positives', () => {
    expect(TokenBriefSchema.safeParse({ ...validBrief, risks: validBrief.risks.slice(0, 2) }).success).toBe(false)
    expect(TokenBriefSchema.safeParse({ ...validBrief, positives: [] }).success).toBe(false)
  })

  it('enforces the verdict enum and sells_pct bounds', () => {
    expect(TokenBriefSchema.safeParse({ ...validBrief, verdict: 'moon' }).success).toBe(false)
    expect(TokenBriefSchema.safeParse({
      ...validBrief,
      dev_profile: { ...validBrief.dev_profile, sells_pct: 101 },
    }).success).toBe(false)
  })

  it('bounds alert explainer and digest lengths', () => {
    expect(AlertExplainerSchema.safeParse({ text: 'Short.' }).success).toBe(true)
    expect(AlertExplainerSchema.safeParse({
      text: Array.from({ length: 81 }, () => 'w').join(' '),
    }).success).toBe(false)
    expect(DigestSchema.parse({ summary: 'Daily digest.' })).toEqual({ summary: 'Daily digest.', highlights: [] })
  })
})

describe('AI guardrails (FR-E3)', () => {
  it('strips URLs and control characters, caps length', () => {
    expect(sanitizeUserText('visit https://evil.example now')).toBe('visit [link] now')
    expect(sanitizeUserText('a\u0000b\nc')).toBe('a b c')
    expect(sanitizeUserText('x'.repeat(500)).length).toBe(300)
  })

  it('keeps chain data out of the static system prompt', () => {
    const world = buildTokenWorld({
      meta: { mint: 'MINT', name: '<script>alert(1)</script>', symbol: 'TMR' },
      events: [event()],
      now: NOW_MS,
    })

    expect(SYSTEM_PROMPT).not.toContain('script')
    expect(SYSTEM_PROMPT).not.toContain('TMR')
    expect(buildBriefUserMessage(world)).toContain('<script>')
  })

  it('sanitizes socials in the user message', () => {
    const world = buildTokenWorld({
      meta: { mint: 'MINT' },
      events: [event()],
      socials: { website: 'https://x.example/path' },
      now: NOW_MS,
    })
    expect(buildBriefUserMessage(world)).toContain('website: [link]')
  })
})

describe('token world snapshot (FR-E1)', () => {
  it('builds meta, bounded events, dev profile, LP status, holders and bundles', () => {
    const many = Array.from({ length: 205 }, (_, index) => event({ block_time: NOW_SEC - 300 + index }))
    const events: TxEvent[] = [
      ...many,
      event({ type: 'sell', wallet: 'dev', token_amount: 50 }),
      event({ type: 'sell', wallet: 'retail', token_amount: 50 }),
      event({ type: 'claim_fees', wallet: 'dev', sol_amount: 2 }),
      event({ type: 'lp_add', block_time: NOW_SEC - 200 }),
      event({ type: 'lp_remove', block_time: NOW_SEC - 100 }),
      event({ type: 'buy', wallet: 'a', slot: 99, block_time: NOW_SEC - 10 }),
      event({ type: 'buy', wallet: 'b', slot: 99, block_time: NOW_SEC - 10 }),
      event({ type: 'buy', wallet: 'c', slot: 99, block_time: NOW_SEC - 10 }),
    ]

    const world = buildTokenWorld({
      meta: { mint: 'MINT', symbol: 'TMR' },
      events,
      holders: Array.from({ length: 25 }, (_, index) => ({ wallet: `h${index}`, pct: 1 })),
      devWallet: 'dev',
      fundingParents: { a: 'parent', b: 'parent', c: 'parent' },
      now: NOW_MS,
    })

    expect(world.meta.symbol).toBe('TMR')
    expect(world.events).toHaveLength(200)
    expect(world.holders).toHaveLength(20)
    expect(world.devProfile.claimsSol).toBe(2)
    expect(world.devProfile.sellsPct).toBe(50)
    expect(world.lpStatus).toBe('removed')
    expect(world.bundleCount24h).toBe(1)
    expect(world.devProfile.ageSeconds).not.toBeNull()
    expect(world.priceSeries.length).toBeGreaterThan(0)
  })
})
