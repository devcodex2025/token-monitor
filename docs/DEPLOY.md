# DEPLOY — Vercel (web) + Fly (worker/bot/api)

## Branch model

- `main` — старий легаси (`origin/main`, `ffef415`). Не чіпаємо.
- `feat/platform-v2` — нова платформа (монорепо, M0–M6). Vercel будує **цю** гілку.

Після стабілізації гілку можна змерджити в `main` (fast-forward або PR), але поки
продакшн-деплой іде з `feat/platform-v2`.

## Vercel (проєкт `token-monitor-2`)

Проєкт уже прив'язаний (`.vercel/project.json` → `prj_dLdtZjdBAwDCnzmNBBaci014CrGL`).
Потрібно змінити дві настройки в Dashboard → Project → Settings:

1. **Root Directory** → `apps/web`
   (монорепо: web лежить у `apps/web`, а не в корені).
2. **Git → Production Branch** → `feat/platform-v2`
   (або лишити `main` і використовувати Preview-деплої гілки).

Vercel автоматично:
- знайде `pnpm-workspace.yaml` у корені репо і встановить залежності через pnpm
  (`packageManager: pnpm@10.18.1` у root `package.json`);
- виконає `pnpm build` у `apps/web` (див. `apps/web/vercel.json`);
- збере `.next` (Next.js preset, `output: standalone`).

Важливо: `apps/web/package-lock.json` видалено — інакше Vercel визначає npm і падає на
`workspace:*` (`Unsupported URL Type "workspace:"`). У `apps/web/vercel.json` явно задано
`installCommand: pnpm install --no-frozen-lockfile`.

Опційно для точного pnpm з `packageManager`: env `ENABLE_EXPERIMENTAL_COREPACK=1`.

З токеном ці налаштування можна застосувати скриптом:

```bash
VERCEL_TOKEN=... pnpm vercel:setup   # Root Directory + framework
```

Production Branch усе одно виставляється в Dashboard → Settings → Git.

### Env vars (Project → Settings → Environment Variables)

Мінімум для web:

```
NEXT_PUBLIC_SITE_URL=https://<домен>
DATABASE_URL=postgresql://...neon...   # з pgvector
HELIUS_API_KEY=...
HELIUS_WEBHOOK_SECRET=...
USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
VAULT_WALLET_ADDRESS=...
REDIS_URL=...
```

Опційно (коли підключимо): `QSTASH_*`, `TELEGRAM_*`, `AI_*`, `TMR_TOKEN_MINT`,
`SENTRY_DSN`, `AXIOM_TOKEN`, `POSTHOG_KEY`.

## Database (Neon)

```bash
DATABASE_URL=... pnpm db:migrate
DATABASE_URL=... pnpm db:seed   # demo org (turbo + boost)
```

Neon: увімкнути extension `vector` перед міграцією.

## Worker / bot / mcp (Fly.io)

```bash
fly launch --no-deploy         # у apps/worker (або окремі fly.toml)
fly secrets set HELIUS_WEBHOOK_SECRET=... DATABASE_URL=... REDIS_URL=...
fly deploy
```

Worker слухає `:4000` (`pnpm --filter @tmr/worker start`), health `GET /health`.
Helius webhook → `https://<worker-host>/api/helius`, header `Authorization` =
`HELIUS_WEBHOOK_SECRET`.

## Rollback

Vercel → Deployments → вибрати попередній → **Promote to Production**.
База: міграції лише forward; для відкату — окрема міграція.

## Що ще не в проді

- `/t/[mint]` зараз на **DEMO DATA** (DB-backed page + backfill — наступний таск).
- Billing/AI/Boost/API — ядро готове й протестоване, але без живих ключів не підключене.
- `apps/web` — легаси Next 14 UI; перепис на Next 15/16 — M1.
