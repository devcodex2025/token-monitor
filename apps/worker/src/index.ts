import { Hono } from 'hono'

/**
 * Worker app (PRD §3): Helius webhook receiver, free-path WS manager, parser, Redis publishing,
 * Rules Engine and delivery dispatcher. Feature wiring lands in M1; health route scaffolded in M0.1.
 */
export const app = new Hono()

app.get('/health', c => c.json({ ok: true, service: 'tmr-worker' }))
