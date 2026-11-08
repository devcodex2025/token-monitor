import { describe, expect, it } from 'vitest'
import { getSolUsdPrice, resetPythCache } from '../src/pyth'

/**
 * Network smoke test — intentionally excluded from CI (AC-A1.2).
 * Run manually with: PYTH_SMOKE=1 pnpm --filter @tmr/parser exec vitest run tests/pyth.network.test.ts
 */
const enabled = process.env.PYTH_SMOKE === '1'

describe.skipIf(!enabled)('pyth network smoke (AC-A1.2)', () => {
  it('fetches a plausible live SOL/USD price', async () => {
    resetPythCache()
    const price = await getSolUsdPrice()
    expect(Number.isFinite(price)).toBe(true)
    expect(price).toBeGreaterThan(1)
    expect(price).toBeLessThan(100_000)
  }, 15_000)
})
