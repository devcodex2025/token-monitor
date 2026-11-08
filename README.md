# Token Monitor ($TMR)

Transparency & analytics layer for Solana tokens. Free token analytics; owners pay for
**Owner Boost**, traders pay for **Turbo** and **AI Insights**. Crypto-only billing (Solana).

> **Source of truth:** [`PRD_TOKEN_MONITOR.md`](./PRD_TOKEN_MONITOR.md).
> Work is executed milestone-by-milestone (M0 → M6) per PRD §9. Planning notes in
> [`docs/planning/`](./docs/planning) are reference only and are not implemented outside the PRD.

## Monorepo layout (PRD §3.1)

```
apps/
  web        Next.js app (legacy Next 14 shell; rewritten on RSC in M1)
  worker     Hono worker: Helius ingest, free-path WS, parser, rules, delivery
  bot-tg     grammy Telegram bot
  mcp        MCP server
packages/
  parser     Parser v2 + TxEvent taxonomy + Pyth adapter + golden fixtures
  auth       SIWS authentication core (nonce, ed25519 verify, sessions)
  db         Drizzle schema v1, migrations, seed
  config     Typed env contract (zod)
  rules      Rules DSL v1
  sdk        Public SDK
  ai         AI Insights
  billing    Solana Pay billing
  ui         Shared UI kit
legacy-token-monitor-2/   Reference clone: parser + fixtures only (not in the workspace)
```

## Local start

```bash
pnpm install
docker compose up -d            # postgres (pgvector) + redis
cp .env.example .env            # fill in secrets; never commit .env
pnpm db:migrate
pnpm db:seed                    # demo org with turbo + boost
pnpm dev                        # turborepo: web :3000, worker, bot
```

If Docker is unavailable, point `DATABASE_URL` at Neon Postgres with the `vector` extension.

## Quality gates

```bash
pnpm build       # turbo build (web + all packages)
pnpm typecheck   # tsc --noEmit across the workspace
pnpm lint        # eslint (antfu config)
pnpm test        # vitest (parser golden fixtures, pyth, db schema, SIWS, env)
```

## Status

- **M0 Foundation** — complete: monorepo + CI (M0.1), parser port + golden fixtures (M0.2),
  Drizzle schema v1 (M0.3), SIWS auth core (M0.4), env + docker-compose (M0.5).
- Next: **M1 Data + Free analytics** (Helius ingest, free-path WS, `/t/[mint]`, SEO, wallet stats, bundle metric).
- Parser fixtures are byte-identical copies of the legacy suite; `pnpm test` runs them against the
  ported parser with the legacy parser as oracle.
