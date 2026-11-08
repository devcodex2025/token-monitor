import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../src/types'
import type { WsAdapter, WsLogEntry } from '../src/ws-manager'
import { FreePathWsManager, WsLimitError } from '../src/ws-manager'

function noopLogger(): Logger {
  return { info: () => {}, warn: () => {}, error: () => {} }
}

function fakeAdapter() {
  const subscriptions: Array<{ mint: string, closed: boolean }> = []
  let nextId = 0

  const adapter: WsAdapter = {
    async subscribeLogs({ mint }) {
      const record = { mint, closed: false }
      subscriptions.push(record)
      nextId++
      return {
        close() {
          record.closed = true
        },
      }
    },
  }

  return { adapter, subscriptions, get count() { return nextId } }
}

describe('FreePathWsManager (FR-B2)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-B2.1: 3 viewers of one mint share exactly 1 WS subscription', async () => {
    const fake = fakeAdapter()
    const manager = new FreePathWsManager({ adapter: fake.adapter, logger: noopLogger() })

    const unsubA = await manager.addViewer('mint-A', 'viewer-1')
    const unsubB = await manager.addViewer('mint-A', 'viewer-2')
    const unsubC = await manager.addViewer('mint-A', 'viewer-3')

    expect(fake.count).toBe(1)
    expect(manager.activeSubscriptions).toBe(1)
    expect(manager.viewerCount('mint-A')).toBe(3)

    await Promise.all([unsubA(), unsubB(), unsubC()])
  })

  it('keeps one subscription per mint', async () => {
    const fake = fakeAdapter()
    const manager = new FreePathWsManager({ adapter: fake.adapter, logger: noopLogger() })

    await manager.addViewer('mint-A', 'v1')
    await manager.addViewer('mint-B', 'v2')

    expect(fake.count).toBe(2)
    expect(manager.activeSubscriptions).toBe(2)
  })

  it('closes a subscription after the idle TTL (10 min default)', async () => {
    vi.useFakeTimers()
    const fake = fakeAdapter()
    const manager = new FreePathWsManager({
      adapter: fake.adapter,
      logger: noopLogger(),
      idleTtlMs: 10 * 60 * 1000,
    })

    const unsubscribe = await manager.addViewer('mint-A', 'v1')
    await unsubscribe()

    expect(fake.subscriptions[0]!.closed).toBe(false)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1)
    expect(fake.subscriptions[0]!.closed).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(fake.subscriptions[0]!.closed).toBe(true)
    expect(manager.activeSubscriptions).toBe(0)
  })

  it('cancels the idle close when a viewer returns', async () => {
    vi.useFakeTimers()
    const fake = fakeAdapter()
    const manager = new FreePathWsManager({
      adapter: fake.adapter,
      logger: noopLogger(),
      idleTtlMs: 1000,
    })

    const unsubscribe = await manager.addViewer('mint-A', 'v1')
    await unsubscribe()
    await vi.advanceTimersByTimeAsync(500)

    await manager.addViewer('mint-A', 'v2')
    await vi.advanceTimersByTimeAsync(2000)

    expect(fake.subscriptions[0]!.closed).toBe(false)
    expect(manager.activeSubscriptions).toBe(1)
  })

  it('enforces the maximum number of active subscriptions', async () => {
    const fake = fakeAdapter()
    const manager = new FreePathWsManager({
      adapter: fake.adapter,
      logger: noopLogger(),
      maxActive: 1,
    })

    await manager.addViewer('mint-A', 'v1')
    await expect(manager.addViewer('mint-B', 'v2')).rejects.toBeInstanceOf(WsLimitError)
    expect(manager.activeSubscriptions).toBe(1)
  })

  it('fans log entries out to the onLogs hook', async () => {
    let emit: ((entry: WsLogEntry) => void) | undefined
    const adapter: WsAdapter = {
      async subscribeLogs({ onLogs }) {
        emit = onLogs
        return { close: () => {} }
      },
    }
    const received: Array<{ mint: string, signature: string }> = []
    const manager = new FreePathWsManager({
      adapter,
      logger: noopLogger(),
      onLogs: (mint, entry) => received.push({ mint, signature: entry.signature }),
    })

    await manager.addViewer('mint-A', 'v1')
    emit?.({ signature: 'sig-1', err: null, logs: [] })

    expect(received).toEqual([{ mint: 'mint-A', signature: 'sig-1' }])
  })
})
