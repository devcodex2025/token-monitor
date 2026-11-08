import type { HeliusTransaction, TxEvent } from '@tmr/parser'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createWorkerApp } from '../src/index'
import type { EventRepository, EventStream, Logger } from '../src/types'

const SECRET = 'test-secret'
const FIXTURES = fileURLToPath(new URL('../../../packages/parser/__fixtures__/', import.meta.url))
const fixture = JSON.parse(
  fs.readFileSync(`${FIXTURES}issue_pump_instruction.json`, 'utf8'),
) as HeliusTransaction

interface LogEntry {
  level: string
  fields: Record<string, unknown>
  message?: string
}

function makeHarness(now: number) {
  const rows = new Map<string, TxEvent>()

  const repository: EventRepository = {
    async insertEvent({ event, raw }) {
      if (rows.has(raw.signature)) return { inserted: false }
      rows.set(raw.signature, event)
      return { inserted: true, id: rows.size }
    },
  }

  const published: TxEvent[] = []
  const stream: EventStream = {
    async publish(event) {
      published.push(event)
    },
  }

  const logs: LogEntry[] = []
  const logger: Logger = {
    info: (fields, message) => logs.push({ level: 'info', fields, message }),
    warn: (fields, message) => logs.push({ level: 'warn', fields, message }),
    error: (fields, message) => logs.push({ level: 'error', fields, message }),
  }

  const app = createWorkerApp({
    repository,
    stream,
    logger,
    webhookSecret: SECRET,
    now: () => now,
  })

  return { app, rows, published, logs }
}

async function post(
  app: ReturnType<typeof createWorkerApp>,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  return app.request('/api/helius', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('Helius ingest (FR-B1)', () => {
  const now = fixture.timestamp * 1000 + 2500

  it('AC-B1.1: parses, persists and publishes a new event', async () => {
    const { app, rows, published } = makeHarness(now)

    const response = await post(app, [fixture], { authorization: SECRET })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toMatchObject({ ok: true, received: 1, inserted: 1, failed: 0 })
    expect(rows.size).toBe(1)
    expect(published).toHaveLength(1)
    expect(published[0]!.mint).toBe('67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev')
    expect(published[0]!.type).toBe('buy')
  })

  it('AC-B1.1: replaying the same webhook inserts only one event', async () => {
    const { app, rows, published } = makeHarness(now)

    await post(app, [fixture], { authorization: SECRET })
    const second = await post(app, [fixture], { authorization: SECRET })

    expect(second.status).toBe(200)
    expect((await second.json()).inserted).toBe(0)
    expect(rows.size).toBe(1)
    expect(published).toHaveLength(1)
  })

  it('rejects an invalid webhook secret with 401', async () => {
    const { app, rows, published } = makeHarness(now)

    const response = await post(app, [fixture], { authorization: 'wrong-secret' })

    expect(response.status).toBe(401)
    expect(rows.size).toBe(0)
    expect(published).toHaveLength(0)
  })

  it('accepts X-Helius-Signature and the Bearer prefix', async () => {
    const { app } = makeHarness(now)

    expect((await post(app, [fixture], { 'x-helius-signature': SECRET })).status).toBe(200)
    expect((await post(app, [fixture], { authorization: `Bearer ${SECRET}` })).status).toBe(200)
  })

  it('AC-B1.2: logs ingest lag = now - block_time', async () => {
    const { app, logs } = makeHarness(now)

    await post(app, [fixture], { authorization: SECRET })
    const entry = logs.find(log => log.message === 'helius.ingest')

    expect(entry).toBeDefined()
    expect(entry!.fields.ingest_lag_ms).toBe(2500)
    expect(entry!.fields.event_type).toBe('buy')
  })

  it('skips transactions with a transactionError', async () => {
    const { app, rows } = makeHarness(now)
    const failed: HeliusTransaction = {
      ...fixture,
      signature: 'failed-signature',
      transactionError: { error: 'InstructionError' },
    }

    const response = await post(app, [failed], { authorization: SECRET })

    expect((await response.json()).skipped).toBe(1)
    expect(rows.size).toBe(0)
  })
})
