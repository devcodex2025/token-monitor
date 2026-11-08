import { describe, expect, it, vi } from 'vitest'
import { pingIndexNow } from '../src/indexnow'

describe('IndexNow ping (FR-B4)', () => {
  it('skips the network call when there are no URLs', async () => {
    const fetchImpl = vi.fn()
    const result = await pingIndexNow({
      host: 'tmr.watch',
      key: 'key',
      urls: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({ ok: true, status: 0, skipped: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts the expected payload', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }))
    const result = await pingIndexNow({
      host: 'tmr.watch',
      key: 'index-key',
      urls: ['https://tmr.watch/t/abc'],
      keyLocation: 'https://tmr.watch/index-key.txt',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({ ok: true, status: 200, skipped: false })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.indexnow.org/indexnow')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      host: 'tmr.watch',
      key: 'index-key',
      keyLocation: 'https://tmr.watch/index-key.txt',
      urlList: ['https://tmr.watch/t/abc'],
    })
  })

  it('reports non-2xx responses', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 429 }))
    const result = await pingIndexNow({
      host: 'tmr.watch',
      key: 'k',
      urls: ['https://tmr.watch/t/a'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, status: 429, skipped: false })
  })
})
