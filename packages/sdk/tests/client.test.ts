import { describe, expect, it, vi } from 'vitest'
import { ApiError, PaymentRequiredError, TokenMonitorClient } from '../src/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function client(fetchImpl: typeof fetch, overrides: Partial<ConstructorParameters<typeof TokenMonitorClient>[0]> = {}) {
  const sleep = vi.fn(async () => {})
  return {
    sleep,
    instance: new TokenMonitorClient({
      baseUrl: 'https://api.tmr.watch/',
      apiKey: 'tmr_live_test',
      fetchImpl,
      retries: 3,
      backoffMs: 100,
      sleep,
      ...overrides,
    }),
  }
}

describe('SDK client (FR-G3)', () => {
  it('calls the token summary endpoint with a bearer key', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ mint: 'MINT', symbol: 'TMR' }))
    const { instance } = client(fetchImpl as unknown as typeof fetch)

    const summary = await instance.getTokenSummary('MINT')

    expect(summary).toEqual({ mint: 'MINT', symbol: 'TMR' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.tmr.watch/v1/token/MINT')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tmr_live_test')
  })

  it('serializes feed query params', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]))
    const { instance } = client(fetchImpl as unknown as typeof fetch)

    await instance.getFeed('MINT', { minSol: 5, since: 100, types: ['buy', 'sell'], limit: 10 })

    const [url] = fetchImpl.mock.calls[0] as [string]
    expect(url).toBe('https://api.tmr.watch/v1/feed/MINT?min_sol=5&since=100&types=buy%2Csell&limit=10')
  })

  it('surfaces 402 as PaymentRequiredError', async () => {
    const fetchImpl = vi.fn(async () => new Response('top up', { status: 402 }))
    const { instance } = client(fetchImpl as unknown as typeof fetch)

    await expect(instance.getTokenSummary('MINT')).rejects.toBeInstanceOf(PaymentRequiredError)
  })

  it('surfaces other 4xx as ApiError', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    const { instance } = client(fetchImpl as unknown as typeof fetch)

    await expect(instance.getTokenSummary('MINT')).rejects.toBeInstanceOf(ApiError)
  })

  it('retries 429 then succeeds with backoff', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls++
      return calls < 2 ? new Response('slow down', { status: 429 }) : jsonResponse({ mint: 'MINT' })
    })
    const { instance, sleep } = client(fetchImpl as unknown as typeof fetch)

    await expect(instance.getTokenSummary('MINT')).resolves.toEqual({ mint: 'MINT' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep.mock.calls).toEqual([[100]])
  })

  it('gives up after the retry budget on 5xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 }))
    const { instance } = client(fetchImpl as unknown as typeof fetch)

    await expect(instance.getTokenSummary('MINT')).rejects.toBeInstanceOf(ApiError)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
