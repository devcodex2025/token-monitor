# ПРОДУКТ-ПЛАН: Token Monitor ($TMR) → Transparency Layer для Solana

*Версія 1.1 · 08.11.2026 · базується на: аудит `token-monitor-2` (webhook 50–150 мс, парсери 8 DEX + LP/fees), аналіз ринку `MARKETING_ANALYSIS_UK.md`, болі r/solana, бенчмарки Whale Alert / CryptocurrencyAlerting / GMGN*

---

## 0. Принцип "без legacy" (застосовується скрізь)

| Забороняємо | Замінюємо |
|---|---|
| Polling RPC | Push у всьому: webhooks / WS / SSE; historical — batch API з кешем |
| Хардкод `SOL ≈ $200` у парсері | Pyth price feed (edge-cache, TTL 2 сек) |
| Один RPC-провайдер | Adapter-шар: Helius ↔ Triton/QuickNode failover |
| Next 14 App Router | Next 15/16 (RSC, PPR) + React 19 + TS strict |
| Стан у пам'яті процесу | Neon Postgres + Drizzle — єдине джерело правди |
| Браузер-сесія як "монітор" | Watch = рядок у БД, server-side watcher-и |
| Білінг "прикрутимо потом" | **Solana Pay (SOL/USDC) prepaid-періоди + SIWS wallet-connect** для всіх платних планів |
| Legacy CLI | `@token-monitor/sdk` (npm) + MCP-сервер |
| Правила, зашиті в UI-код | Версіонований Rules DSL (JSON) — один для UI, бота й API |

Старі модулі переносяться в монорепо **тільки як порти з golden-тестами** — у вас уже 40+ fixture-json з історії баг-фіксів, це готова база регрес-тестів парсера.

---

## 1. Візія і позиціонування

**Один рядок:** *Token Monitor — безкоштовна аналітика для кожного токена Solana; власники платять за представлення свого токена (Owner Boost), трейдери — за професійну швидкість (Turbo) і AI-інсайти.* Ми не продаємо торгівлю — ми продаємо **аналітику, довіру і приховану присутність токенів**.

- **НЕ** термінал: не воюємо з GMGN/Photon/Axiom — на них ведемо користувача через реферальні CTA ("Trade on Photon") і заробляємо на referral fee.
- **Проти** Whale Alert / CryptocurrencyAlerting: Solana-native аналітика подій (DEV SELL, LP Remove), швидкий відгук у платних (Helius paid), AI-шар, якого в них немає.
- **Слоган**: *"The transparency layer of Solana."*

Назва **Token Monitor** і тікер **$TMR** зберігаються: токен уже на Bags.fm, назва містить SEO-ключі ("token monitor", "solana token monitor", "pump fun monitor"), exact-match домен = безкоштовне SEO.

---

## 2. Персони та jobs-to-be-done

| Персона | Біль (підтверджено спільнотами) | Відповідь продукту |
|---|---|---|
| **Власник токена (dev / команда)** | токен потонув у 20k+ щоденних лаунчів: потрібен трафік, довіра і красива сторінка | **Owner Boost** ($99/токен/міс): verified-сторінка + проф-аналітика + бренд-бот + embed + Dev Pulse |
| Memecoin-трейдер | «dev продає, поки графік ще зелений»; DD вручну 30+ хв | Turbo: швидкий відгук + DEV SELL / LP Remove алерти; AI Insights: Token Brief за 10 с |
| CTO-спільнота (10–50k людей) | треба «доказати: dev не в грі»; бот-монітори «не працюють» | White-label фід + брендований TG-бот + embed на сайт, SLA доставки |
| KOL / TG-канал | потрібен щоденний контент і монетизація каналу | AI Daily Digest + рефки в сигналах |
| Builder / AI-агент | Helius Enhanced parsing складний; DIY (n8n) хрупкий | Public Feed API + MCP + prepaid-ключі (SOL/USDC) |
| Whale/fund | приватний multi-wallet watch + webhook-out у свою інфру | API Pro (приватний доступ, високі ліміти) |

---

## 3. Повна карта продукту з ПЛАТНИМИ функціями

### 3.1 Free — "Basic Analytics" (кожен токен Solana має свою аналітику)
- **Кожен торгуємий токен автоматично отримує сторінку** `/t/<mint>` (програматичний індекс через наш потік): ціна/обсяги (24h/7d), buy/sell balance, топ-10 холдерів, liquidity, **живий фід** (standard швидкість), базові статуси подій (LP remove, dev sell — видно в історії).
- **Джерело даних: публічний Solana RPC** (`api.mainnet-beta.solana.com`) з WS-підпискою: стандартна швидкість (~1–3 с), rate-limits → COGS ≈ $0.
- Опція BYO Helius key (для швидкості без оплати).
- Без AI, без алерт-доставки, без server-side watcher-ів.

### 3.2 Turbo — професійна аналітика + швидкий відгук ($29/міс)
1. **Швидкий відгук (Helius paid, наш ключ)**: Enhanced Webhooks → 50–150 мс до фіда й алерту. Головна відчутна різниця Free↔Turbo.
2. **Професійні метрики**: повний розподіл холдерів, wallet PnL-таблиці, net-flow (H1/H24/H7), buy/sell pressure, liquidity depth.
3. **Watchlist до 10 токенів + live-алерти** (TG): DEV SELL (≥ % supply), LP Add/Remove, Claim Fees, bundle-патерн (координовані покупки).
4. **Доставка**: Telegram (головний), Discord, Email (Resend), Web Push, webhook-out (HMAC).
5. **Critical-mode UI**: full-screen алерт + звук.
6. **Historical**: CSV/JSON export, агрегати.
7. **$TMR-фішка**: hold 1M+ $TMR → −25%; burn → 30 днів Turbo (публічна burn-сторінка).

### 3.3 AI Insights — окремий апгрейд ($19/міс; бандл Turbo+AI → $39/міс)
- **AI Token Brief** (повний), **Alert Explainer**, **AI Monitor Builder** (правила словами), **AI Q&A у бота**, **AI Daily Digest** (пост у ваш TG).
- Free-сторінки бачать замок-прев'ю AI-блоку (без LLM-виклику) — конверсія без витрат.

### 3.4 Owner Boost — ОСНОВНА БІЗНЕС-МОДЕЛЬ (власники токенів) ($99/міс за токен)
Аналог DexScreener Token Profile ($300 разово), але **recurring + live-складова**:
1. **Verified-сторінка токена**: бейдж "Owner Boosted", логотип, опис, соц-лінки — управління зdashboard.
2. **Постійна професійна аналітика** сторінки (Turbo-рівень метрик, без обмежень Free).
3. **Branded embed** live-фіду на сайт проекту + **брендований TG-бот** у канал.
4. **Branded OG/share-картки** — красиві соц-пости.
5. **Dev Pulse** branded + алерти для команди.
6. **Priority SEO**: кастомний OG, каталожна категоризація, швидкий реіндекс.
7. Знижки: 3+ токени → **$79/токен**; річна оплата **−20%**.

### 3.5 API / Партнери (опційний канал, $49/міс база + usage)
*Дані через наш Helius paid-канал: parsed події без власної RPC-інфраструктури.*
- REST `GET /v1/feed/{mint}?event=dev_sell|lp_add|lp_remove|claim_fees|bundle` + `GET /v1/wallet/{addr}/score` + SSE-stream, TS SDK **`@token-monitor/sdk`**, MCP-сервер `token-monitor`.
- **Оплата крипто-native: prepaid-баланс на API-ключі** (депозит SOL/USDC; списання ~$0.003/виклик) — жодних карток; авто-докупка через Solana Pay invoice.

### 3.6 Матриця тарифів

| Функція | Free | Turbo $29 | AI $19 | Owner Boost $99/токен |
|---|---|---|---|---|
| Сторінка токену | базова аналітика | професійна | + AI-прев'ю | **verified + професійна** |
| Джерело даних | публічний RPC (standard) або BYO key | **Helius paid** (50–150 мс) | — | Helius paid |
| Watchlist + live-алерти | — | 10 токенів | — | власний токен (unlimited) |
| Правила (DEV SELL / LP / bundle) | — | ✅ | ✅ (builder) | ✅ |
| Доставка TG/Discord/Email/Push | — | ✅ | ✅ | ✅ (включно з каналом) |
| Розширена аналітика (holders PnL, net-flow, liquidity depth) | базова | ✅ | ✅ | ✅ |
| AI Brief / Explainer / Builder / Q&A / Digest | — | — | ∞ | з бандлом Turbo+AI |
| Embed-віджет + бренд-бот | — | — | — | ✅ |
| Branded OG / share | стандарт | — | — | ✅ |
| Dev Pulse | статус на сторінці | + алерти | — | branded + алерти |
| Export CSV/JSON | — | ✅ | ✅ | ✅ |
| API key | — | 10k ev/міс | 10k ev/міс | 50k ev/міс |
| $TMR знижка | — | −25% | −25% | −10% |
| Support | community | 48 год | 48 год | 24 год |

**Бандл:** Turbo+AI → **$39/міс** (замість $48) — головна пропозиція для трейдерів.
**Бізнес-правило:** оплата — **крипто Solana (SOL/USDC) через Solana Pay**, prepaid-періоди 1/3/12 міс; Free = публічний RPC (COGS ≈ 0, без AI); Helius-швидкість і AI — тільки платно; **Owner Boost — головний MRR-двигун** (власники платять за представлення токена).

### 3.7 Унікальний шар — те, чого немає ні у кого ("Signature Features")

Ці фічі виникають винятково з нашої архітектури: глибокий парсер подій + postgreSQL `wallet_stats` + share-поверхні + $TMR.

| # | Фіча | Що це | На чому тримається (наш актив) | План |
|---|---|---|---|---|
| 1 | 🔬 **Rug Autopsy** | Автопост-мортем rug'а: таймлайн buys/sells з тегами класів (dev/bundler/whale/retail), «хто встиг», діаграма фінансування, збитки retail. Генерується через 60 сек після LP Remove | LP-детект у парсері (уже є) + wallet_stats історія | Free — watermarked teaser (SEO/вірус), Boost — branded |
| 2 | 👤 **1-Tap Wallet Trace** | Клік на будь-яку адресу → «хто фінансував гаманець», PnL по всіх токенах, winrate | wallet_stats (накопичується сам, data moat) | Turbo |
| 3 | ⏪ **Replay / Time Machine** | Дивитись лаунч будь-якого токена в "живій" швидкості (зі звуком), режим тренування з алертами як live | історичні tx_events + той самий Feed UI | Turbo, Boost (контент для каналу) |
| 4 | 💓 **Dev Pulse** | Live-лампа dev-гаманця: SOL-баланс, claim-fees, перший sell → green/yellow/red + алерт. «Proof of liveness» на сторінці токена | claim-fees parser (уже є) + dev-detect (M2) | статус — усім; алерти Turbo; branded — Boost |
| 5 | 🧰 **Typed Events Embed** | Спільнота отримує не текст-лог, а typed-події з фільтрами — embed/бот/API живуть на одному Rules DSL | Rules DSL v1 (M2) | Boost/API |

**Чому це moat:** Rug Autopsy, Wallet Trace і метрики поведінки вимагають **world-state гаманців** (funding-графи, PnL-історія, теги) — саме це збирається в `wallet_stats` з першого дня. Конкуренти зберігають потоки, а не state, тому фічі не копіюються без місяців накопичення даних.

---

## 4. AI-фічі: продумане підключення

### 4.0 Спільна AI-інфраструктура (одне ядро — усі фічі)

```
   context-builder: token_world снапшот (dev-wallet, холдери,
   iсторія 200 подій, агрегати) — ОДИН для всіх фіч
        │
        ▼  Vercel AI SDK 5 · Zod structured outputs · streaming
        │  provider-agnostic: primary Claude-Haiku-class,
        │  fallback GPT-mini-class; embeddings 3-small-class
        │
   ┌────┴─────────── guardrails ───────────────┐
   │ · контент із чейна (назви, соцмережі) —    │
   │   untrusted: лише у user-prompt, sanitized │
   │ · Zod-strict схема завжди                  │
   │ · budget meter (Redis sliding window/план) │
   │ · логи без ключів і PII                    │
   └────────────────────────────────────────────┘
        │
        ▼  pgvector semantic cache (re-use summary ≤15 хв → ≈$0)
```

**7 дизайн-рішень (чому це Продумано, а не демо):**
1. **Один world-snapshot** → усі AI-фічі живляться ним: консистентність + дешевші виклики (cache-hit ~80%).
2. **Семантичний cache (pgvector)**: brief по тому ж токену ≤15 хв → повторний виклик майже $0.
3. **Structured outputs завжди**: UI отримує об'єкт, а не текст-на-парсинг.
4. **Prompt-injection захист**: назви/соц-лінки токенів — реальний вектор скама; у system-prompt не потрапляють узагалі, вихід рендериться без innerHTML.
5. **Бюджетна політика по планах**: Free — AI вимкнений; Pro — fair-use з авто-даунгрейдом на нижчу модель при витrafанні.
6. **Model routing**: короткі пояснення → найменша модель; brief/Q&A → середня; scout-батчі → мала + embedding. Економія ~40%.
7. **Evals у CI**: golden-set (50 алерт → пояснення) — якість впала → не деплоїмо.

### 4.1 Фічі (як працюють, чому продають)

| # | Фіча | Контекст→вихід | Модель | Бізнес-роль |
|---|---|---|---|---|
| 1 | **AI Token Brief** (`/t/<mint>`, TG `/brief`) | world-snapshot → {dev-профіль, топ-холдери, ризики, 3 факти, соц-чек} | середня + cache | «30 хв DD за 10 с» — головний конвертер у Turbo |
| 2 | **AI Alert Explainer** | подія + 20 подій фону → 1–2 рядки людською («Dev продає 2.4% supply у 4 транзакціях — 12 с тому») | мала (≤80 tok output) | алерт стає цитатою для X = віральний канал |
| 3 | **AI Monitor Builder** | NL («алерт коли dev продасть >1% supply за 5 хв») → JSON-DSL (Zod) → валідація → watch | середня, few-shot DSL | прибирає фрікцію onboarding: правило без dashboard |
| 4 | **AI Scout** (Boost-токени) | батч нових токенів → детерміновані фічі (bundle%, sniper%, dev-історія) → score → LLM-ранг тільки топ-20 | мала + embeddings | «за що платиш» власникам: контент-машина для каналу |
| 5 | **AI Daily Digest** | денні агрегати → 200-word пост (UA/EN) → TG sendMessage | мала | місток лояльності каналу; економить редактору 30 хв/день |
| 6 | **AI Q&A у бота** | останні K подій + агрегати → відповідь | середня (RAG-lastK) | бот = асистент, а не спамер |
| 7 | **MCP для агентів** | tools: subscribe / summary / dev_history / screen | API | AI-агенти = покупці даних 2026; prepaid-ключі (SOL/USDC) |
| 8 | **Аномалії (не-LLM)** | EWMA/sigma на volume + мережа кошів; LLM — тільки пояснення | статистика | детектор rug-патернів без галюцинацій |
| 9 | **AI Rug Autopsy Narrative** | wallet_stats + класифікація гаманців → story-картка «як це виявилось»: таймлайн, хто встиг, суми | середня (структурний нхід) | вірусний контент: rug-автопсії шалять коланом по X/TG |

### 4.2 Бюджет AI (на юзера/міс, з кешем)

| Фіча | Викликів/д | $/міс |
|---|---|---|
| Brief | 2–5 | ~$0.12 |
| Explainer | 10–30 | ~$0.03 |
| Builder | 1–3 | ~$0.09 |
| Q&A | 5–20 | ~$0.18 |
| Scout/Digest (Boost) | batch | ~$0.9 |
| **Разом Pro** | | **≈ $0.5–0.9** → при ціні $29 маржа >97% тільки по AI |

---

## 5. Технічний план реалізації

### 5.1 Стек (2026-modern)

| Шар | Вибір |
|---|---|
| Frontend | Next 15/16 App Router (RSC, PPR), React 19, TS strict, Tailwind 4, shadcn/ui, PWA |
| API | Hono (edge) на Next route handlers, OpenAPI-генерація, prepaid-key middleware |
| БД | Neon Postgres + Drizzle ORM + pgvector |
| Queue/Realtime | Upstash Redis (Streams, rate limits) + QStash (ретраї, крони) |
| Ingest worker | Hono на Fly.io (2 micro-VM) |
| Джерело даних | Free: **публічний Solana RPC** (WS-підписка, standard) · Платні плани: **Helius paid tier** (Enhanced Webhooks) — provider-adapter (Helius↔Triton failover) |
| Realtime | SSE через Vercel edge (web); WS-gate на Fly для API Pro |
| Auth | better-auth (self-host, passkeys + OAuth + orgs) |
| Billing | **Solana Pay (SOL/USDC, SIWS wallet-connect) + prepaid-періоди 1/3/12 міс** · $TMR burn-модуль · (картки через MoR — опція пізніше, крипта-first) |
| Bots | grammy (TG, webhooks) · discord.js |
| LLM | Vercel AI SDK 5, Zod structured outputs (provider-agnostic) |
| Docs | fumadocs (Next-native dev-portal) |
| Обсерв. | Sentry + Axiom + PostHog (EU) |
| SEO | Satori OG-зображення, ISR, sitemap-per-mint, IndexNow |
| Monorepo | Turborepo + pnpm: apps/web, worker, bot-tg, bot-discord, mcp; packages/parser, db, sdk, ui, rules |

### 5.2 Архітектура

```mermaid
flowchart LR
  HEL[Helius Enhanced Webhooks\n(платні плани, наш paid key)] --> W[Ingest worker · Hono/Fly]
  PUB[Публічний Solana RPC · WS\n(Free-план, standard)] --> W
  W --> P[Parser v2\n(порт 8 DEX-парсерів\n+ golden-тести)]
  P --> PR[Pyth price\ncache 2s]
  P --> BUS[(Redis Streams)]
  BUS --> S[SSE/WS fan-out\nпо watch-keys]
  BUS --> D[(Postgres/Drizzle\ntx_events, wallet_stats,\nwatches, alerts, orgs, subs)]
  D --> R[Rules Engine v2\nDSL eval]
  R -- fire --> Q[QStash retry]
  Q --> TG[Token Monitor Bot · TG]
  Q --> DC[Discord]
  Q --> EM[Email]
  Q --> WH[Webhook-out HMAC]
  D --> AI[AI core · AI SDK 5\npgvector cache · budget]
  AI --> WEB[web · Next 15\n/t/:mint share · embed · PWA]
  AI --> MCP2[MCP server token-monitor\n+ prepaid billing · api.tmr.watch]
  WEB --> SEO[OG · sitemap · IndexNow]
  R --> WEB
```

**Ключові архітектурні рішення:**
- `tx_events` — append-only події; `wallet_stats` — upsert-агрегати (без "перерахуй історію").
- Helius webhook реєструється один на mint (усі watcher-и того ж токена розділяють його) → дешеве масштабування.
- Watch живе в БД: `org → watch(ies) → delivery_targets → rulesets`.
- Rules DSL (JSON v1) валідується Zod; один движок працює в worker і прев'ю на клієнті.
- **Prepaid-key middleware**: депо SOL/USDC на API-ключ → списання за виклик (~$0.003) → Redis-баланс → авто-інвойс на докупку через Solana Pay.
- Multi-tenancy з першого дня (`org_id` на всім); Owner Boost = то ж саме + branding config на токен-сторінку, без нових таблиць.

### 5.3 Roadmap 12 тижнів

| Фаза | Тижні | Робота | Стан після фази |
|---|---|---|---|
| **M0 Rebase** | 1 | Монорепо, порт parser → package з золотими тестами, Next 15, better-auth, Drizzle schema (users, orgs, watches, tx_events, wallet_stats, alerts, api_keys, subs), CI | чиста база + auth |
| **M1 Ingest** | 2–3 | Fly-worker, webhook receiver, Redis bus, SSE-апгрейд, wallet_stats, новий watchlist UI (переписаний TokenInput/TransactionFeed) | free-режим стабільний |
| **M2 Alerts + Billing** | 3–5 | Rules DSL v1 (DEV SELL/LP/bundle), dev-wallet detect, QStash delivery, grammy-бот, **Solana Pay billing (SOL/USDC, prepaid-періоди)**, план-гейти, Metering | **перші $: Turbo checkout live** |
| **M3 SEO surfaces** | 5–6 | `/t/:mint` share (ISR + OG), sitemap, embed-iframe + postMessage, **Replay/Time Machine v1** | органічний трафік |
| **M4 AI** | 6–8 | AI-ядро: world-snapshot, pgvector cache, Brief/Explainer/Builder/Q&A, TG-інтеграція, budget meter, evals, **AI Rug Autopsy v1** | **AI-диференціатор live** |
| **M5 API/MCP/Boost** | 8–10 | /v1 API (Hono + OpenAPI), SSE/WS, `@token-monitor/sdk`, fumadocs портал, MCP, **prepaid API-key баланс (SOL/USDC)**, **Owner Boost: verified-сторінки** | dev-сегмент + boost-сейли |
| **M6 Boost finalize** | 10–11 | бренд-бот, embed-брендинг, branded OG, Digest у канал, $TMR burn-gate, multi-token знижки, AI Rug Autopsy v1 для boost токенів | Boost paid, MRR-двигун |
| **Launch** | 12 | beta 500, seed 10 CTO-спільнот, X/PH launch, рефки у всіх алертах | MRR > $1k |

### 5.4 Як переносимо наявний код (без руйнування)
- `lib/parsers/*` → package `parser` (уніфікований тип `TxEvent`), 40+ fixture-json → золоті тести.
- `lib/transactionParser.ts` → `tx-core` + Pyth adapter.
- `app/api/*` → Hono-роути; SSE-логіка — на edge.
- `cli.ts`, `index.js` (legacy) → прибираються, замінюються `@token-monitor/sdk`.
- Cyberpunk-естетика збережена як **Theme "Terminal"**, паралельно додаємо Theme "Modern".

---

## 6. Домен і бренд

**Бренд не змінюємо: Token Monitor, $TMR (Bags.fm).** Це актив: назва = SEO-запит, тікер живий і вже несе ідентичність.

### 6.1 Рекомендація доменів

| Пріоритет | Домен | Роль |
|---|---|---|
| 🥇 Primary | **tmr.watch** | короткий (тікер + семантика "watch = монітор"), головний URL |
| 🥈 Альтернатива | **tmr.live** | семантика live-фіду ("ваш токен — live"), другий варіант при виборі |
| 🥉 Другорядні | tmr.io, tmr.tools | dev-friendly / захисні дублі |
| Redirect | tokenmonitor.app | exact-match SEO-редірект, купувати *тільки як* redirect і тільки якщо дешево |
| Суб-домени | api.tmr.watch, docs.tmr.watch | безкоштовні |
| SNS | **tmr.sol** | Solana Name Service — резервація |

Перевірка доступності — в реєстраторі (Namecheap/Cloudflare/SNS) за 10 хв; бюджет ~$60–100/рік на всі. Якщо `tmr.watch` зайнятий → `tmr.live` / `tmr.tools` / `tmr.watch.pro`. Соціальні хендли бра'ть одразу пачкою: @tmrwatch, @tokenmonitorbot (TG), @tmr_watch (X).

### 6.2 Бренд-гайдлайни
- Дві теми UI: "Terminal" (наша спадщина) + "Modern".
- Signature-елемент share-сторінки: **Dev Wallet status badge** (green/yellow/red) — це візуальна візитка в X.
- На OG-картинках: латентність "50ms" + "0 API calls — pure webhooks" — ваші технічні переваги як маркетинговий пункт.
