# PRD — Token Monitor ($TMR) · "Transparency & Analytics Layer for Solana"

**Версія 1.0 · 08.11.2026 · домен: tmr.watch · виконавець: агент (OpenCode + DeepSeek v4.1)**

> Це єдине джерело правди для реалізації. Посилатися на фічі за ID (FR-x, AC-x, M-x.y). Якщо вимога неоднозначна — дотримуйся дефолту з §2.7 (Assumptions) і не блокуйся; усі відхилення фіксуй у PR як коментар `// PRD-note:`.

---

## 1. Контекст

### 1.1 Що вже є (легаси: github.com/devcodex2025/token-monitor-2 · Next 14 · dev-деплой на Vercel)
- Працюючий **live feed** транзакцій Solana: Helius Enhanced Webhooks → API route → SSE → dark "terminal"-UI; детект BUY/SELL; **8 DEX-парсерів** (Pump.fun, Jupiter, Meteora, OKX, Bags, DFlow, OnchainLabs, Raydium/base); події **LP Add/Remove** і **Claim Fees** з конверсією USDC/USDT→SOL.
- **40+ золотих fixture-JSON** у `tests/` (реальні транзакції + репро-кейси багів) — обов'язково переносимо як golden-тести парсера. Локальний клон легаси лежить у `tm2-audit/` робочої папки (бере тебе — копіюй звідти; інакше — з GitHub).
- Historical-режим через Helius search API; token-info endpoint; CLI/легаси (`cli.ts`, `index.js`) — **видаляється**.
- Токен **$TMR** уже живий (Bags.fm) — тікер і бренд зберігаємо, не перепродаємо.

### 1.2 Продукт в одному реченні
Безкоштовна аналітика для кожного токена Solana; власники платять за **Owner Boost** (verified-сторінка + брендинг), трейдери — за **Turbo** (швидкість + проф-аналітика) і **AI Insights**. Оплата — лише крипта Solana (SOL/USDC). Ми не трейдінг-термінал і не воронка торгівлі.

### 1.3 Не-цілі (заборонено будувати)
- Trade/swap-функціонал, виконання угод, дотик до приватних ключів користувачів (тільки SIWS-підпис + pubkey).
- Снайпер-детекція (вилучена на вимогу власника). Bundle-метрика (скоординовані покупки) — лишається як *звичайна метрика scam-профілю токена*.
- Discord-бот, email-доставка, Push-канали — не в MVP (тільки Telegram + веб; email — після M4).
- Мультичейн (тільки Solana).

---

## 2. Продуктові вимоги верхнього рівня

### 2.1 Персони
1. **Owner (dev/команда токена)** — платить Boost $99/міс за токен; хоче verified-сторінку, трафік, довіру спільноти, бренд-бот у своєму каналі.
2. **Trader** — апгрейди Turbo $29 (швидкість, проф-метрики, алерти) і/або AI $19 (brief, explainer, Q&A).
3. **Viewer (free)** — безкоштовна аналітика будь-якого токена (стандартна швидкість, без AI).
4. **Builder/AI-agent** — public API (prepaid-ключ, база $49/міс) + MCP-сервер.

### 2.2 Тарифи (фінальна таблиця — реалізувати точно)

| Можливість | Free | Turbo $29/міс | AI $19/міс | Owner Boost $99/міс/токен | API $49+/міс |
|---|---|---|---|---|---|
| Сторінка `/t/<mint>` | базова аналітика | профі-метрики | + AI-preview (замок) | **verified + профі** | — |
| Джерело даних | публічний RPC (standard) | **Helius paid** (50–150 мс) | — | Helius paid | Helius paid |
| Watchlist/алерти (TG) | — | 10 токенів | — | свій токен (безліч) | — |
| Профі-метрики (holders PnL, net-flow, liquidity) | базові | ✅ | ✅ | ✅ | ✅ (API) |
| AI (brief/explainer/builder/Q&A/digest) | — | — | ✅ ∞ | через бандл Turbo+AI | AI-endpoint за usage |
| Embed + бренд-бот | — | — | — | ✅ | — |
| Branded OG | стандарт | — | — | ✅ | — |
| Dev Pulse | статус | + алерти | — | branded + алерти | — |
| Export CSV/JSON | — | ✅ | ✅ | ✅ | ✅ |
| Rules DSL | — | ✅ | ✅ | ✅ | ✅ |
| Bundle-метрика (координовані покупки) | метрика сторінки | алерт | алерт | алерт | ✅ |
| API-ключ (event-квота/міс) | — | 10k | 10k | 50k | usage-based prepaid |
| $TMR знижка (hold ≥1M) | — | −25% | −25% | −10% | −10% |

- Бандл **Turbo + AI = $39/міс** (замість $48).
- Знижки оплати: 12-місячний період −20% (усі платні), multi-token Boost (3+) → $79/токен/міс.
- **$TMR utility**: hold ≥1M → знижка (перевірка балансу через RPC при checkout); альтернатива — **burn → +30 днів Turbo** (публічна burn-сторінка, лог on-chain).

### 2.3 Оплата (crypto-only, Solana)
- **Solana Pay**: підключення гаманця через SIWS (Phantom/Solflare, @solana/wallet-adapter); інвойс → transfer на наш vault (**USDC SPL з memo=invoice_id**; або SOL за Pyth-курсом на момент інвойсу +2% буфер); підтвердження через RPC polling `getTransaction(signature)`; план прив'язується до адреси гаманця (org = wallet-based).
- **Prepaid періоди: 1 / 3 / 12 міс.** Авто-renew без custodial неможливий → реалізація: сесії + TG-бот нагадування за 3 дні до кінця + one-click pay-link (Solana Pay URL) у боті. Grace 3 дні → далі downgrade до Free.
- **API prepaid-баланс**: депозит SOL/USDC на API-ключ → списання ~$0.003/виклик (Redis atomic + nightly snapshot у Postgres) → авто-інвойс на поповнення.
- Карток, Polar, x402 — **немає** у MVP.

### 2.4 Два шляхи даних (обов'язково обидва)
- **Free path**: публічний RPC `api.mainnet-beta.solana.com` + fallback-список (env), WS-підписка `logsSubscribe`/`programSubscribe` — тільки для відкритих сторінок. Target latency ≤3 с.
- **Paid path (Turbo/Boost/API)**: Helius Enhanced Webhooks ("fast path"), платний ключ у env. Target: 50–150 мс (дані), ≤2.0 с p95 (алерт-доставка).
- Обидві ноги сходяться в **один Parser v2 → `TxEvent` → шину**. Жодних різних парсер-логік для двох шляхів — інакше розбіжність даних уб'є довіру.

### 2.5 Таксономія подій (TxEvent) — основа всієї аналітики
`types = buy | sell | lp_add | lp_remove | claim_fees | transfer | burn | mint_created (dev_launch)`.
Похідні (derived): `dev_sell`, `dev_buy`, `bundle` (3+ buys в одному слоті від гаманців зі спільним funding_parent), `whale_op` (≥ порогу N SOL, env-конфіг).

Кожна подія: `{ mint, type, dex, slot, block_time, wallet, sol_amount (конвертація за Pyth), token_amount, price_at_tx, fee_sol, related_wallets?, raw? }`.

### 2.6 AI — paid-only
Free: замок-прев'ю блоку на сторінці (статичний, без LLM-виклику) — конверсія без COGS. Деталі §7.

### 2.7 Assumptions / дефолти (агент вирішує в цей бік)
- Ідентичність: wallet address через SIWS — без email/password. TG-юзер прив'язується до org через deep-link.
- Ціни номіновані в USD; показ у SOL/USDC за Pyth quotes; приймаємо **нативний USDC SPL mint** Solana.
- Часові зони: UTC.
- База: Neon Postgres + Drizzle; кеш/ліміти: Upstash Redis; черги: QStash.
- Неймінг: "Token Monitor", тікер $TMR; мова UI — EN (дефолт).
- Export CSV: rate-limit 20/день/орг.
- Моделі AI: мапа через env (задаються пізніше, provider-agnostic).

### 2.8 Success criteria пілота (перевірка на M6)
- Перші **3 Boost + 30 Turbo** оплати через Solana Pay (реальні транзакції, скрипт-верифікатор).
- 1000+ проіндексованих free-сторінок; OG-прев'ю коректні при шерінгу в X (≥60%).
- p95 Turbo-алерт-доставки ≤2.0 с; free-сторінки LCP ≤2.5 с.
- AI COGS ≤ $0.9/юзер/міс (середній cache-hit ≥70%).

### 2.9 NFR
- SSE-фід: reconnect-safe (Last-Event-ID), keep-alive ping 15 с.
- Ідемпотентність всюди: ingest (dedup по signature), payments (по tx_sig), AI cache (по context_hash).
- Публічні ліміти: 10 RPC-запитів/с на free-viewer (Upstash sliding window); webhook-out — тільки платним, HMAC-SHA256.
- Security: Helius webhook signature-header (shared secret); SIWS — nonce з TTL 5 хв, перевірка ed25519-підпису; приватних ключів юзерів у бекенді **немає** (лише pubkey/addr).
- DB: усі org-об'єкти несуть `org_id`; Boost-об'єкти прив'язані до `mint`.

---

## 3. Цільова архітектура

```
[Free viewers]─public RPC WS┐                      ┌→ SSE web feed, token pages (Next 15)
                            ├→ ingestion bus       ├→ Postgres (events, stats, boosts, subs)
[Helius webhooks]───────────┤   (Redis Streams)    ├→ Rules Engine → QStash → TG bot (grammy)
   (fast path, paid)        ├→ price adapter (Pyth)├→ AI core (AI SDK 5 + pgvector cache)
                            └→                      ┴→ wallet_stats (Postgres) → public API (Hono) + MCP
```

- **apps/web** — Next 15/16 App Router: `/t/[mint]`, dashboard, billing UI, Boost-admin, OG/sitemap.
- **apps/worker** — Hono (Node runtime) на Fly.io: Helius webhook receiver, free-path WS monitor manager, parser, Redis publishing, Rules Engine, delivery dispatcher, historical indexer (backfill).
- **apps/bot-tg** — grammy (webhook через worker-роут або окремий fly-ап — рішення агента).
- **apps/mcp** — MCP server (stdio + SSE transport) поверх packages/sdk.
- **packages/** — parser, rules, db (Drizzle schema + client), sdk (types + fetch-client), ai (prompts, cache, provider), billing (invoice/payment-verify), ui (shadcn-kit).

### 3.1 Монорепо (pnpm + turborepo)
```
apps/{web, worker, bot-tg, mcp} · packages/{parser, rules, db, sdk, ai, billing, ui}
```
Тулза: TypeScript strict, ESLint (antfu config) + prettier, Vitest, Turborepo pipeline build/test/lint.

---

## 4. Функціональні вимоги (FR) з acceptance criteria

### Модуль A — Фундамент (M0)

- **FR-A1 (Порт парсера).** Перенести `lib/parsers/*` + `transactionParser.ts` з легаси → `packages/parser` з єдиним вихідним типом `TxEvent` (§2.5); конверсія цін через **Pyth adapter** (кеш 2 с), SOL-ціна НЕ хардкод.
  - AC-A1.1: усі 40+ fixture-JSON скопійовані в `packages/parser/__fixtures__/`; golden-тести (type, dex, sol_amount ±1e-9, wallet) — **100% pass** на типах `buy, sell, lp_add, lp_remove, claim_fees, transfer, mint_created`.
  - AC-A1.2: Pyth-adapter unit: SOL=const mock → конверсія точна; сетевий smoke-тест з-поза CI.
- **FR-A2 (Schema DB v1).** Drizzle schema (§5), міграції + seed: org/user/tokens/events/stats/boost/subscriptions/payments/api_keys/audit.
  - AC-A2.1: `pnpm db:migrate` з нуля на чистий Neon ок; `pnpm db:seed` створює demo-org (turbo + boost на demo-mint).
- **FR-A3 (SIWS auth).** better-auth + **власний SIWS plugin**: message с nonce → підпис гаманцем → сесія bound to wallet; org авто-створюється per wallet.
  - AC-A3.1: Логін Phantom (devnet) → session cookie → `/dashboard` (empty state).
  - AC-A3.2: невалідний підпис → 401; повторне використання того ж nonce → 401.

### Модуль B — Дані + Free-аналітика (M1)

- **FR-B1 (Helius ingest).** Worker: `POST /api/helius` з signature-check (`HELIUS_WEBHOOK_SECRET`) → parser → Redis Stream `txs:main` + persist `tx_events` (ідемпотентно по signature).
  - AC-B1.1: повторний replay одного webhook 2× → в DB 1 event.
  - AC-B1.2: метрика ingest-lag (created_at − block_time) у structured logs.
- **FR-B2 (Free-path WS manager).** Один WS-pідпис `logsSubscribe` на mint для N viewer-ів (fan-in); WS гаснеться після 10 хв без viewer-ів; ліміт 50 активних WS одночасно (env).
  - AC-B2.1: 3 viewer-и одного mint → 1 WS-підписка (лог/метрика).
- **FR-B3 (Token page + агрегати).** `/t/[mint]`: token meta (Helius DAS на paid; `getTokenLargestAccounts`/`getTokenInfo` на free; кешується), price series (останні 200 подій, VWAP-вікно 5 м), панелі: 24h/7d volume · buys/sells · unique wallets · net-flow · top-10 holders (кеш 5 м, RPC-guard) · LP status з lp-events · live-фід · **Dev Pulse лампа** (green/yellow/red за SOL-баланс dev_wallet і перший sell).
  - AC-B3.1: перший візит невідомого токена → сторінка збудована ≤5 с (блокуючий backfill на перший рендер).
  - AC-B3.2: `/t/<mint>` SSR + OG (Satori template, стандартний).
- **FR-B4 (Programmatic SEO).** Sitemap chunks по 50k URL (mint-лист з DB), robots, IndexNow-ping на нові mint. OG: стандартний для free; branded — якщо Boost.
  - AC-B4.1: sitemap.xml валідний, ≤50 MB; OG-картка містить symbol, price, dev-status.
- **FR-B5 (Wallet stats + dev detect).** На кожну подію: upsert `wallet_token_stats` + `wallet_stats` (first_seen, last_seen, funding_parent — ONE hop через перший transfer-in, totals, tags[]: dev/whale/bundler). dev_wallet = creator з `mint_created`; fallback — топ-власник.
  - AC-B5.1: для fixture-сценаріїв теги dev/whale/bundler коректні.
- **FR-B6 (Bundle-метрика).** У межах слота: ≥3 buys від ≥3 гаманців зі спільним funding_parent → derived `bundle` з агрегатом `{count, sol_total, wallets[]}`. Видна як метрика на сторінці + доступна з Rules (§6). **Не** алерт-only.
  - AC-B6.1: unit-тест на синтетичний слот.

### Модуль C — Billing (M2) ← перші гроші

- **FR-C1 (Solana Pay checkout).** Потік: Plan → період → інвойс (row у `payments`) → QR у UI → polling RPC `getTransaction` → верифікація (status=success; destination=vault; amount≥invoice; memo=invoice_id; USDC-mint=env) → `subscriptions.prepaid_until = max(now, prepaid_until)+period` → лог.
  - AC-C1.1: devnet-оплата через скрипт `pnpm billing:pay-devnet <invoice>` → sub активований.
  - AC-C1.2: подвійна оплата відкритого інвойсу → друга оплата зарахована як продовження (не помилка).
  - AC-C1.3: SOL-оплата верифікується за Pyth price snapshot у момент інвойсу +2% буфер.
- **FR-C2 (Entitlements).** Middleware `withPlan(plan)` на API-роутах + hook `useEntitlements` (SSR з sub-таблиці). Порядок: Free→Turbo→AI→Boost→API. Grace-state "past_due" 3 дні.
  - AC-C2.1: доступ до Turbo-роуту з Free → upsell-сторінка (HTTP 200 з upsell-UI, не 500).
- **FR-C3 (TG renew-бот).** За 3 дні (і щодня в grace): повідомлення → кнопка "Продовжити" → Solana Pay URL інвойсу → після оплати бот присилає підтвердження.
  - AC-C3.1: mock-TG інтеграційний тест cron QStash.

### Модуль D — Turbo (M2)

- **FR-D1 (Watchlist + Rules Engine).** Org створює rules (до 10 watched tokens): правила з DSL (§6) оцінюються на всі поточні події через Redis consumer; fire → delivery.
- **FR-D2 (Доставка).** QStash queue → adapters: telegram (bot API, retry 3× з backoff), webhook-out (HMAC) для платних. Таблиця `delivery_log`.
  - AC-D2.1: правило dev_sell поріг ≥1% supply: подія fire → TG-повідомлення ≤2 с p95 від ingest.
  - AC-D2.2: невдачі доставки → retry, після 3 → status=fail у log; UI banner "degraded".
- **FR-D3 (Turbo page + export).** Для paid-планів: Helius-fast data на фіді та stats; CSV/JSON export `/api/export/[mint]?from&to` (ліміт 20/день).
- **FR-D4 (Advanced metrics).** Holder PnL-таблиця (top-20 по buy_sol з unrealized PnL за поточною ціною), net-flow-держави (hourly), liquidity depth (lp_add − lp_remove history).
  - AC-D4.1: числа сходяться з ручним fixture-сценарієм.

### Модуль E — AI Insights (M3) ← paid-only

- **FR-E1 (AI core).** `packages/ai`: `buildTokenWorld(mint)` → snapshot (§7.1) → Redis-cache 5 м; provider-agnostic (Vercel AI SDK 5), model map env `AI_MODEL_BRIEF/EXPLAINER/CHAT`; **structured outputs Zod для ВСІХ фіч**.
- **FR-E2 (Фічі).** Token Brief на `/t/[mint]` (schema §7.2); Alert Explainer (≤80 tokens out, приходить у TG разом з алертом); AI Monitor Builder (EN NL → Rules DSL JSON + валідатор → save); AI Q&A у боті (`/ask`); AI Daily Digest (по watchlist або Boost-токену, cron 09:00 UTC).
  - Budget: free — static lock-preview; AI-план прив'язаний до org; ліміт через Redis sliding window (tokens/day/org, env default 200k).
- **FR-E3 (Кеш + guardrails).** pgvector cache (feature, mint, context_hash), TTL 15 хв (explainer 5 хв). Chain-дані (token names/socials) підставляються **тільки у user-message** після sanitize (max 300 chars, strip URLs/control chars); outputs ніколи не рендеряться як HTML.
  - AC-E3.1: 30 golden prompts (eval-набір) → усі outputs проходять Zod; name-стрінг `<script>` з fixture НЕ потрапляє у system prompt.
  - AC-E3.2: повторний brief ≤15 хв → 0 нових LLM-токенів (cache-hit у логах).
- **FR-E4 (Cost meter).** Кожен виклик → usage-row у `ai_usage(org_id, feature, tokens_in/out, usd_est)`; простий SQL-звіт перевіряє таргет "$0.9/юзер/міс".

### Модуль F — Owner Boost (M4) ← головний MRR

- **FR-F1 (Boost subscription).** Boost прив'язується до конкретного mint у org. Потік: SIWS → вибір mint (пошук/вставка) → **Ownership proof**: (a) wallet = dev_wallet(mint) з FR-B5 (авто), АБО (b) message-sign "I own mint X" верифікація.
  - AC-F1.1: не-owner mint → Boost кнопка прихована; API-спроба → 403.
- **FR-F2 (Verified page).** На `/t/[mint]`: badge "Owner Boosted", кастомні опис/logo/socials (форма у dashboard), CTA-кнопки (env/налаштовувані), постійні профі-метрики (Turbo-рівень), **branded OG** (Satori template з logo/brand-color), каталог `/boosted` (listing із CTA).
  - AC-F2.1: OG-brand тест: snapshot og:image-роута з кастомним лого.
- **FR-F3 (Branded TG-бот).** Обране для Boost: повідомлення про "Bought/Sold X SOL" + кастомний logo/icon, кастомні шаблони подій (template variables), deep-link на сторінку. Підключення: admin вставляє chat_id, бот ведеться на канал через invite.
  - AC-F3.1: formatting-тест TG-повідомлення (mock Bot API).
- **FR-F4 (Embed).** `<script src="tmr.watch/embed.js" data-mint>` + iframe `/embed/[mint]?theme&lang`; postMessage handshake для resize; branded (logo) тільки для Boost; для non-Boost — watermark "Powered by Token Monitor".
  - AC-F4.1: playground-сторінка `/embed-demo` з обома темами.
- **FR-F5 (Boost analytics + renew).** Boost dashboard: OG-кліки, traffic (PostHog share endpoint), renew-напомінання як FR-C3.

### Модуль G — Public API + MCP (M5)

- **FR-G1 (REST + OpenAPI).** Hono-app `api.tmr.watch`: `GET /v1/feed/[mint]` (params: min_sol, since, types, limit), `GET /v1/token/[mint]` (summary), `GET /v1/wallet/[addr]/score`, SSE `/v1/stream/[mint]`; OpenAPI-doc route; auth `Authorization: Bearer tmr_live_*` (key-hash у DB).
  - AC-G1.1: OpenAPI JSON валідний (зі схемою); curl з live-key → 200; прострочений ключ → 401; ліміт → 429.
- **FR-G2 (Prepaid billing).** Кожен request: cost списується з балансу ключа (Redis atomic Decr); при низькому залишку → прапорець "top-up needed"; депозит SOL/USDC → верифікація як FR-C1, з прив'язкою invoice↔key → баланс +=.
  - AC-G2.1: баланс=0 → `402` JSON з посиланням на інвойс.
- **FR-G3 (SDK).** `packages/sdk`: типізований клієнт (спільні типи), retry/backoff; npm-назва `@token-monitor/sdk`.
  - AC-G3.1: CI-білд + vitest на клієнт.
- **FR-G4 (MCP).** `apps/mcp`: tools `subscribe_token`, `get_token_summary`, `get_dev_history`, `screen_new_tokens`, `get_wallet_score`; auth через env key; docs-page.
  - AC-G4.1: інтеграція з mcp-inspector пройшла; manual QA-чеклист Claude Desktop у docs.

### Модуль H — Signature-фічі (M5, після G)

- **FR-H1 (Rug Autopsy).** Тригер: lp_remove з виведенням ≥90% ліквідності АБО price −95% за 60 с (по подіях). Через 60 с після тригера async job будує autopsy-картку на `/t/[mint]/autopsy`: timeline buys/sells з тегами (dev/whale/bundler/retail), "хто встиг" вийти, діаграма фінансування (parents→children), AI Narrative — якщо org має AI. Free — з водяним знаком; Boost — branded.
  - AC-H1.1: fixture lp_remove → картка рендериться; screenshot-тест.
- **FR-H2 (Replay / Time Machine).** `/t/[mint]/replay?from=t0`: подає історичні події в той же Feed UI ("Play 1×/2×", звук) — не просто знімок поточного стану.
  - AC-H2.1: підтримка 30 днів історії (query за time ranges у `tx_events`), перемотка/scrub.
- **FR-H3 (1-Tap Wallet Trace).** Клік на адресу у фіді → панель: funding chain (1 hop), PnL по всіх токенах (`wallet_token_stats` × поточна ціна), winrate. `?view=funding` serve з stats. Free — обмежено (теги + перша транзакція); повна — Turbo.
- **FR-H4 (Export).** Розширення FR-D3 з rate-limit; Boost має безліч зі свого mint.

---

## 5. Схема даних (Drizzle — конспект, реалізуй точно)

```ts
// orgs: id uuid pk default gen_random_uuid(), name text, wallet text unique, created_at
// users: id uuid pk, wallet text unique (SIWS), tg_chat_id text nullable, created_at
// org_members: org_id fk, user_id fk, role text ('owner'|'admin'|'member')
// tokens: mint text pk, symbol, name, decimals int, logo_uri, dex text, discovered_at, dev_wallet text nullable
// boost_items: org_id fk, mint fk → tokens, verified bool, custom jsonb (desc/logo/socials/cta), active bool, expires_at
// tx_events: id bigserial pk, mint text, event_type text, dex text, slot bigint, block_time timestamptz, wallet text,
//   sol_amount numeric(20,9), token_amount numeric(38,0), price numeric(20,12), fee_sol numeric(20,9),
//   signature text UNIQUE (idempotency), related_wallets jsonb, raw jsonb nullable
//   INDEX (mint, block_time DESC), INDEX (wallet, block_time DESC)
// wallet_stats: wallet text pk, first_seen, last_seen, funding_parent text null, funding_slot bigint, totals jsonb, tags text[] default '{}'
// wallet_token_stats: wallet, mint, buy_sol, sell_sol, buy_token, sell_token, first_buy_at, last_sell_at, pk (wallet, mint)
// token_daily: mint, day date, volume_sol, buys int, sells int, unique_wallets int, net_flow_sol, pk (mint, day)
// holder_snapshots: mint, captured_at, top jsonb — cron 10 м (paid/boost), 60 м (free)
// rules: id uuid pk, org_id fk, mint text, type text, params jsonb, enabled bool, created_at
// deliveries: id uuid pk, org_id fk, kind text ('tg'|'webhook_out'), target jsonb, secret text null, enabled
// delivery_log: id, rule_id fk null, event_id fk null, kind, status text, error text, created_at
// subscriptions: id, org_id fk, plan text ('turbo'|'ai'|'boost'|'api'), status ('active'|'grace'|'expired'),
//   prepaid_until timestamptz, period jsonb, created_at (boost → активує/деактивує пов'язані boost_items)
// payments: id, org_id fk, invoice_id text unique, plan, period_days int, asset ('USDC'|'SOL'), amount_requested numeric,
//   tx_signature text unique null, verified_at, status ('pending'|'paid'|'expired'), memo text
// api_keys: id, org_id fk, key_hash text unique, label, balance numeric(20,6) default 0, rate_limit_ppm int, enabled
// ai_usage: id, org_id, feature text, tokens_in int, tokens_out int, cost_usd numeric, created_at
// ai_cache: context_hash text pk, feature, mint, payload jsonb, embedding vector(1536), created_at
```

> `tx_events` — найбільша таблиця: місячні партиції НЕ потрібні на старті ( простих індексах + retention job — delete >365 d). RLS не використовуємо: org-scope фільтрація строго на app-рівні (repository layer). Усі sum-об'єкти несуть `org_id`/`mint`.

---

## 6. Rules DSL v1 (JSON, версійований)

```json
{ "v": 1, "type": "dev_sell",  "params": { "min_pct_supply": 1 } }
{ "v": 1, "type": "lp_remove", "params": { "min_pct_liquidity": 90 } }
{ "v": 1, "type": "whale_op",  "params": { "min_sol": 50, "side": "buy | sell | any" } }
{ "v": 1, "type": "bundle",    "params": { "min_wallets": 3 } }
{ "v": 1, "type": "claim_fees","params": { "min_sol": 10 } }
{ "v": 1, "type": "volume_spike","params": { "x_median_1h": 5 } }   // EWMA/сигма-базлайн
```

- Zod schema `RuleSchema` — єдиний валідатор у `packages/rules`; поруч використовується і в UI (client preview), і в worker (evaluation). Тест на кожен type: синтетичні fixtures (positive/negative/boundary).

---

## 7. AI підсистема

### 7.1 token_world snapshot (`packages/ai/world.ts`)
Input → `{meta, price series 24h, events last 200 (compacted), holders top-20 + pct, dev_wallet profile (баланс, claims, sells, age), lp_status, bundle_count_24h, socials (кастомні для Boost)}`. Це ЄДИНИЙ контекст для всіх фіч.

### 7.2 Feature specs
- **Token Brief** (сторінка + `/brief <mint>` у боті). Zod: `{summary (max 80 слів), dev_profile {balance_sol, sells_pct, claims_sol}, risks[3] {title, why}, positives[3] {title, why}, verdict: 'calm' | 'chop' | 'activity' | 'risky' }`.
- **Alert Explainer**: 1–2 речення на подію (input = event + 20 подій фону), ≤80 tokens out.
- **Monitor Builder**: NL (EN/UA) → Rules DSL JSON; validation error → "не можу" fallback (не вигадує нових типів).
- **Q&A**: chat зі snapshot + lastK 20 подій; max 5 exchanges/хв/org.
- **Digest**: daily summarization (cron 09:00 UTC) по watchlist або Boost-токену, до 200 слів.

### 7.3 Guardrails
- System prompt статичний (EN); chain-дані (token names/socials) — тільки у user-message після sanitize; outputs ніколи не виконуються як HTML.
- Budget sliding window Redis (tokens/день/org) → м'який stop з "AI limit" у повідомленні.
- Semantic cache: exact-hash fast path + embedding fallback (cosine ≥0.98) для digest/summary reuse.
- Evals: `packages/ai/__evals__` — 30 scenarios (fixtures → Zod pass + keyword-assertions). Поза CI (в CI — mock-provider; живий provider — лише smoke-скриптом).

### 7.4 Cost targets (M3 DoD)
- Brief cached ≤ $0.004/бріф; explainer ≤ $0.001; загальний AI COGS ≤ $0.9/юзер/міс при cache-hit 70%.

---

## 8. Стек і середовище

| Сфера | Вибір |
|---|---|
| Frontend | Next 15/16 App Router, React 19, TS strict, Tailwind v4, shadcn/ui, PWA manifest |
| Server-heavy | Hono (worker + api), Fly.io deploy (2× shared-cpu) |
| DB | Neon Postgres, Drizzle ORM, pgvector extension |
| Rate/queue | Upstash Redis (Streams, rate-limit, balance), QStash (schedules/retry) |
| Auth | better-auth + власний SIWS plugin (@solana/wallet-adapter) |
| Realtime | SSE (Last-Event-ID resumable), keep-alive 15 с |
| Бот | grammy (Telegram) |
| AI | Vercel AI SDK 5, provider env-driven, Zod structured outputs |
| Ціни | Pyth Hermes (SOL/USDC), adapter + 2 с кеш |
| Observability | pino → Axiom (logs), Sentry (DSN env, optional), PostHog (EU) |
| SEO | Satori OG, ISR (`revalidate 60`), sitemap split, IndexNow |
| Hosting | Vercel = web (edge), Fly.io = worker + api + bot |

**Env-лист** (заповнити `env.example`, no secrets у repo):
`DATABASE_URL · REDIS_URL · QSTASH_TOKEN · QSTASH_CURRENT_SIGNING_KEY · QSTASH_NEXT_SIGNING_KEY · HELIUS_API_KEY · HELIUS_WEBHOOK_SECRET · TELEGRAM_BOT_TOKEN · TELEGRAM_WEBHOOK_SECRET · AI_API_KEY (per provider) · AI_MODEL_BRIEF · AI_MODEL_EXPLAINER · AI_MODEL_CHAT · PYTH_HERMES_URL · VAULT_WALLET_ADDRESS (публічний; sweep вручну) · USDC_MINT_ADDRESS · TMR_TOKEN_MINT (для hold-знижок) · NEXT_PUBLIC_SITE_URL · NEXT_PUBLIC_RPC_FALLBACKS · SENTRY_DSN · AXIOM_TOKEN · POSTHOG_KEY`

**Локальний старт (чекліст агента):** `pnpm i` → `docker compose up` (postgres + redis, recommended) → `pnpm db:migrate && pnpm db:seed` → `pnpm dev` (turborepo: web 3000, worker 4000, бот у poll-mode dev) → `pnpm test`.

---

## 9. Roadmap (агент виконує порядком M0→M6; кожен таск = PR)

| Мілейстоун | Тижні | Таски по порядку |
|---|---|---|
| **M0 Фундамент** | 1 | M0.1 monorepo scaffold + CI (vitest, lint, build) · M0.2 parser port + golden fixtures (AC-A1) · M0.3 Drizzle schema v1 + migrate/seed (FR-A2) · M0.4 SIWS auth (FR-A3) · M0.5 env management + docker-compose dev |
| **M1 Дані + Free-аналітика** | 2–3 | M1.1 Helius ingest (FR-B1) · M1.2 free WS manager (FR-B2) · M1.3 token page + агрегати (FR-B3) · M1.4 SEO/OG/sitemap (FR-B4) · M1.5 wallet_stats + dev detect (FR-B5) · M1.6 bundle-метрика (FR-B6) |
| **M2 Billing + Turbo** | 3–5 | M2.1 Solana Pay invoice + verify (FR-C1) · M2.2 entitlements middleware (FR-C2) · M2.3 TG renew-бот (FR-C3) · M2.4 watchlist + rules + DSL validator (FR-D1, §6) · M2.5 delivery adapters + delivery_log (FR-D2) · M2.6 Turbo page + CSV (FR-D3) · M2.7 advanced metrics (FR-D4) |
| **M3 AI Insights** | 6–8 | M3.1 world snapshot + provider map (FR-E1) · M3.2 Brief + Explainer (FR-E2) · M3.3 Builder + Q&A (FR-E2) · M3.4 Digest cron · M3.5 pgvector cache + budgets (FR-E3) · M3.6 ai_usage звіт (FR-E4) |
| **M4 Owner Boost** | 8–10 | M4.1 ownership proof + Boost sub (FR-F1) · M4.2 verified page + branded OG (FR-F2) · M4.3 branded TG-бот (FR-F3) · M4.4 embed.js + iframe (FR-F4) · M4.5 Boost dashboard (FR-F5) |
| **M5 API + Signature** | 10–12 | M5.1 public API + OpenAPI (FR-G1) · M5.2 prepaid баланс (FR-G2) · M5.3 SDK (FR-G3) · M5.4 MCP (FR-G4) · M5.5 Rug Autopsy (FR-H1) · M5.6 Replay (FR-H2) · M5.7 Wallet Trace (FR-H3) |
| **M6 Hardening + launch** | 12+ | M6.1 стрес-тест delivery (k6 на mock webhooks) · M6.2 smoke E2E (Playwright: signup → pay devnet → watch → alert) · M6.3 docs + `docs/RUNBOOK.md` · M6.4 launch checklist (OG, sitemap, IndexNow, TG-invite flow) |

Приймання кожного епіка: всі AC ок локально; `pnpm test` зелений; `pnpm build` без помилок; міграції застосовуються з нуля; демо-кроки відтворюються з чистого старту (env.example заповнений).

---

## 10. Testing strategy

1. **Golden parser tests**: fixture-JSON легаси → `packages/parser/__fixtures__` (точна копія); loader + snapshot assertions (type, dex, sol_amount ±0.000001, wallet). Нові баг-репорти додають нові fixtures (процес).
2. **Rules engine**: table-driven tests (кожен DSL type: positive, negative, boundary).
3. **Billing**: mocked Solana RPC (fixture tx.json), golden invoice verify; ідемпотентність (FR-C1 AC).
4. **AI**: provider-mocked structured outputs + guardrail-тести (§FR-E3).
5. **Integration smoke**: docker-compose (postgres + redis) → e2e ingest→rule→tg(mock).
6. **Chrome smoke (M6)**: Playwright шлях: connect wallet (mock adapter) → pay devnet invoice → watch token → отримати алерт у mock TG.

Quality gates per PR: vitest affected · `tsc --noEmit` · eslint · build.

---

## 11. Observability і Runbook

- Структуровані логи (pino/JSON): повний pipeline отримує trace_id {event_id → rule fire → delivery attempt}.
- Alerting: ingest lag >5 с; delivery fail-rate >1%; AI-budget misses; payment verify fails; WS active count = 0 у робочі періоди високого трафіку.
- `docs/RUNBOOK.md`: як підняти локально; деплой (Vercel + Fly); реєстрація Helius webhook; додавання fallback-RPC. Секрети — тільки в env; приватних ключів юзерських гаманців у бекенді НІКОЛИ немає (тільки pubkey/addr); vault — лише приймаюча адреса, sweep вручну.

---

## 12. Взаємодія агента (як працювати по цій PRD)

1. Виконуй мілейстоуни в порядку M0→M6; у межах мілейстоуна — таск-порядку.
2. **Один таск = один PR**; commit message "M2.3: TG-renew bot (FR-C3)".
3. Перед PR: `pnpm test && pnpm build` локально green + AC-чеклист у PR description (кожен AC: ✅/❌ + причина для ❌).
4. Що незрозуміло — вирішуй за §2.7 і фіксуй у коді як `// PRD-note:`. Нічого не вигадуй.
5. Легаси з `token-monitor-2` переносити тільки як parser-референс + fixtures. Старі UI-компоненти — джерело стилю (тема "Terminal"), але переписані на RSC/нову структуру.
6. Не додавати залежності поза §8 без причини, задокументованої в PR.
7. Функції ≤40 рядків; Strict TS: `any` забороняється lint-правилом.

---

## 13. Відкриті питання (не блокують; дефолти з §2.7)
- Точні моделі-default по планах (уточнити при першому прорахунку AI-бюджету в M3).
- Хостинг `embed.js` — CORS-політика на CDN tmr.watch (окреме рішення в M4).
- Мова UI — EN default; UA пізніше (i18n-JSON).

---

*Кінець PRD. Виконуватися агентом цілком — починай з M0.1.*
