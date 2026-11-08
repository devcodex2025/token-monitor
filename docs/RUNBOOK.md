# RUNBOOK — Token Monitor ($TMR)

Operational guide for the monorepo. Source of truth for product scope: `PRD_TOKEN_MONITOR.md`.

## 1. Prerequisites

- Node.js >= 22
- pnpm 10 (`corepack enable`)
- Docker (recommended) for local Postgres + Redis, or a Neon `DATABASE_URL` with the `vector` extension
- A Helius API key for the paid path (optional locally; the free path works without it)

## 2. Local start

```bash
pnpm install
docker compose up -d          # postgres16 + pgvector, redis7
cp .env.example .env          # fill DATABASE_URL, REDIS_URL, HELIUS_WEBHOOK_SECRET, ...
pnpm db:migrate               # apply packages/db/migrations
pnpm db:seed                  # demo org: turbo + boost on the demo mint
pnpm dev                      # web :3000, worker :4000, bot (turborepo)
```

Web: http://localhost:3000 · token demo: `/t/67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev`

Without Docker, point `DATABASE_URL` at Neon and ensure `CREATE EXTENSION vector` is available.
The token page currently renders demo fixtures until DB-backed loading is enabled.

## 3. Database

```bash
pnpm db:generate   # drizzle-kit generate after schema changes
pnpm db:migrate    # apply migrations (packages/db/src/migrate.ts)
pnpm db:seed       # idempotent demo seed
```

Notes:
- `tx_events.signature` is UNIQUE — ingest is idempotent.
- Migration `0000_*` includes `CREATE EXTENSION IF NOT EXISTS vector`.
- Retention: delete `tx_events` older than 365 days (job not yet scheduled).

## 4. Worker (ingest)

- `POST /api/helius` — Helius Enhanced Webhook receiver.
- Auth: send the shared secret in `Authorization` (or `X-Helius-Signature`); optional `Bearer ` prefix.
  The secret must equal `HELIUS_WEBHOOK_SECRET`. Empty secret rejects every request (401).
- Pipeline: Parser v2 -> `TxEvent` -> idempotent `tx_events` insert -> Redis Stream `txs:main`.
- Structured log line `helius.ingest` includes `ingest_lag_ms = now - block_time` (AC-B1.2).
- Health: `GET /health`.

### Registering the Helius webhook

1. Helius dashboard -> Webhooks -> Add.
2. URL: `https://<worker-host>/api/helius`.
3. Auth header: the exact `HELIUS_WEBHOOK_SECRET` value.
4. Select transaction types / addresses you index, then save.

## 5. Deploy

- **web** — Vercel, root `apps/web` (Next.js). Set all `NEXT_PUBLIC_*` and server env vars.
- **worker / bot-tg / mcp** — Fly.io (Node). Build with the workspace, run `pnpm --filter @tmr/worker start`.
- Run migrations from CI/release step: `pnpm db:migrate`.

## 6. Secrets policy (PRD §11)

- Never commit `.env` / secrets; `.env*` is gitignored except `.env.example`.
- The backend never stores user private keys — only wallet addresses and signatures (SIWS).
- `VAULT_WALLET_ADDRESS` is a receiving-only address; sweep manually.
- Webhook-out deliveries are signed with HMAC-SHA256 (`signWebhookPayload`).

## 7. SEO

- `/sitemap.xml` and `/robots.txt` are generated in `apps/web/app`.
- Large deployments: use `@tmr/seo` `chunkUrls()` (50k chunks) with Next `generateSitemaps()`.
- IndexNow: `pingIndexNow({ host, key, urls })` from `@tmr/seo`; call it from the discovery job, not CI.

## 8. Golden parser fixtures

- Fixtures live in `packages/parser/__fixtures__/` (byte-identical copy from legacy).
- `scripts/gen-golden.ts` regenerates `golden.json` using the legacy parser as oracle:
  ```bash
  node_modules/.bin/tsx scripts/gen-golden.ts
  ```
- `pnpm --filter @tmr/parser test` must stay green.

## 9. Quality gates (required before every commit/PR)

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Network-only checks are opt-in: `PYTH_SMOKE=1 pnpm --filter @tmr/parser exec vitest run tests/pyth.network.test.ts`.

## 10. Troubleshooting

- **`db:migrate` fails on vector type** — enable the `vector` extension (Neon: Extensions -> vector).
- **Worker 401** — `HELIUS_WEBHOOK_SECRET` empty or header mismatch.
- **Token page shows DEMO DATA** — DB-backed loading not enabled yet; see the token-page task.
- **ESLint TTY error** — ensure optional eslint plugins are installed; the config disables React/Vue presets.
- **Turbo test flakiness under parallel load** — run `pnpm test` and `pnpm lint` sequentially.
