import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSolUsdPrice,
  resetPythCache,
  solToUsd,
  usdToSol,
} from '../src/pyth'

function hermesResponse(price: string, expo: number): Response {
  return new Response(
    JSON.stringify({ parsed: [{ price: { price, conf: '1', expo, publish_time: 1 } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('pyth adapter (AC-A1.2)', () => {
  beforeEach(() => {
    resetPythCache()
  })

  it('converts SOL to USD exactly at a constant price', () => {
    expect(solToUsd(2, 150)).toBe(300)
    expect(solToUsd(0.5, 200)).toBe(100)
  })

  it('converts USD to SOL exactly at a constant price', () => {
    expect(usdToSol(300, 150)).toBe(2)
    expect(usdToSol(100, 200)).toBe(0.5)
  })

  it('rejects a non-positive SOL price', () => {
    expect(() => usdToSol(1, 0)).toThrow()
    expect(() => usdToSol(1, -1)).toThrow()
  })

  it('parses the Hermes price with its exponent', async () => {
    const fetchImpl = vi.fn(async () => hermesResponse('15000000000', -8))
    const price = await getSolUsdPrice({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 0 })
    expect(price).toBe(150)
  })

  it('caches the price for 2 seconds', async () => {
    let now = 0
    const fetchImpl = vi.fn(async () => hermesResponse('20000000000', -8))

    expect(await getSolUsdPrice({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now })).toBe(200)
    expect(await getSolUsdPrice({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now + 1_999 })).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    now = 2_000
    expect(await getSolUsdPrice({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now })).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('surfaces HTTP failures', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }))
    await expect(
      getSolUsdPrice({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 0 }),
    ).rejects.toThrow(/503/)
  })
})
