import type { TxEvent } from '@tmr/parser'
import type { DeliveryAdapter, DeliveryPayload } from '../src/delivery'
import type { Logger } from '../src/types'
import { describe, expect, it, vi } from 'vitest'
import {
  deliverWithRetry,
  formatTelegramMessage,
  signWebhookPayload,
} from '../src/delivery'

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump',
    type: 'buy',
    dex: 'Pump.fun',
    block_time: 1_760_000_000,
    wallet: '8iTjomWRwalletshort',
    sol_amount: 0.25,
    token_amount: 1000,
    ...partial,
  }
}

function noopLogger(): Logger {
  return { info: () => {}, warn: () => {}, error: () => {} }
}

function payload(text = 'hello'): DeliveryPayload {
  return { kind: 'tg', event: event(), text, data: {} }
}

describe('Telegram formatting (FR-D2)', () => {
  it('formats a buy alert with symbol, amount, wallet and dex', () => {
    const text = formatTelegramMessage(event({ type: 'buy', sol_amount: 1.5 }), { symbol: 'TMR' })

    expect(text).toContain('🟢 BUY 1.5000 SOL · TMR')
    expect(text).toContain('wallet 8iTj…hort')
    expect(text).toContain('Pump.fun')
  })

  it('formats a sell alert and includes explainer + link', () => {
    const text = formatTelegramMessage(event({ type: 'sell' }), {
      explainer: 'Dev sold part of the supply.',
      link: 'https://tmr.watch/t/abc',
    })

    expect(text).toContain('🔴 SELL')
    expect(text).toContain('Dev sold part of the supply.')
    expect(text).toContain('https://tmr.watch/t/abc')
  })

  it('uses a neutral emoji for non-trade events', () => {
    expect(formatTelegramMessage(event({ type: 'transfer' }))).toContain('↔️ TRANSFER')
  })
})

describe('webhook HMAC signing', () => {
  it('is deterministic and 64 hex chars', () => {
    const first = signWebhookPayload('secret', '{"a":1}')
    const second = signWebhookPayload('secret', '{"a":1}')

    expect(first).toBe(second)
    expect(first).toMatch(/^[\da-f]{64}$/)
  })

  it('depends on the secret and the body', () => {
    const base = signWebhookPayload('secret', 'body')
    expect(signWebhookPayload('other', 'body')).not.toBe(base)
    expect(signWebhookPayload('secret', 'other')).not.toBe(base)
  })
})

describe('delivery retry (FR-D2 / AC-D2.2)', () => {
  it('succeeds after transient failures with exponential backoff', async () => {
    let calls = 0
    const adapter: DeliveryAdapter = {
      async send() {
        calls++
        if (calls < 3) throw new Error('transient')
      },
    }
    const sleep = vi.fn(async () => {})

    const result = await deliverWithRetry(adapter, payload(), noopLogger(), { retries: 3, backoffMs: 100, sleep })

    expect(result).toEqual({ status: 'ok', attempts: 3 })
    expect(calls).toBe(3)
    expect(sleep.mock.calls).toEqual([[100], [200]])
  })

  it('marks the delivery failed after 3 attempts', async () => {
    const adapter: DeliveryAdapter = {
      async send() {
        throw new Error('down')
      },
    }
    const sleep = vi.fn(async () => {})

    const result = await deliverWithRetry(adapter, payload(), noopLogger(), { retries: 3, sleep })

    expect(result).toEqual({ status: 'fail', attempts: 3, error: 'down' })
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('does not sleep after the final attempt', async () => {
    const adapter: DeliveryAdapter = {
      async send() {
        throw new Error('x')
      },
    }
    const sleep = vi.fn(async () => {})

    await deliverWithRetry(adapter, payload(), noopLogger(), { retries: 1, sleep })
    expect(sleep).not.toHaveBeenCalled()
  })
})
