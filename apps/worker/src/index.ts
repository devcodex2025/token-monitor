import type { HeliusTransaction } from '@tmr/parser'
import type { IngestDependencies } from './ingest'
import type { EventRepository, EventStream, Logger } from './types'
import { Hono } from 'hono'
import { ingestTransactions } from './ingest'
import { secureCompare } from './security'

export interface WorkerDependencies {
  repository: EventRepository
  stream: EventStream
  logger: Logger
  webhookSecret: string
  now?: () => number
  inferMint?: IngestDependencies['inferMint']
}

/**
 * Worker HTTP app (PRD §3): Helius webhook receiver. Feature wiring for WS/Rules/delivery
 * lands in later M1/M2 tasks.
 */
export function createWorkerApp(deps: WorkerDependencies): Hono {
  const app = new Hono()

  app.get('/health', c => c.json({ ok: true, service: 'tmr-worker' }))

  app.post('/api/helius', async (c) => {
    const rawHeader = c.req.header('authorization') ?? c.req.header('x-helius-signature') ?? ''
    const provided = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7) : rawHeader

    if (!secureCompare(provided, deps.webhookSecret)) {
      deps.logger.warn({ path: '/api/helius' }, 'helius.unauthorized')
      return c.json({ error: 'unauthorized' }, 401)
    }

    let body: unknown
    try {
      body = await c.req.json()
    }
    catch {
      return c.json({ error: 'invalid_json' }, 400)
    }

    const transactions = (Array.isArray(body) ? body : [body]) as HeliusTransaction[]
    const result = await ingestTransactions(transactions, deps)
    return c.json({ ok: true, ...result })
  })

  return app
}
