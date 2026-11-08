# HANDOFF — що це і як використовувати

Ця папка — **референс легаси** `github.com/devcodex2025/token-monitor-2` для виконання `PRD_TOKEN_MONITOR.md` (у корені репо). Джерело правди — **тільки PRD** (§12.5: з легаси переноситься тільки parser + fixtures).

## Розкладка

| Шлях | Що це | Куди в PRD |
|---|---|---|
| `lib/transactionParser.ts` | Головний парсер (роутер DEX) | FR-A1 → `packages/parser` |
| `lib/parsers/*.ts` (9 файлів) | base + bags, dflow, jupiter, meteora, okx, onchainlabs, pumpfun, types | FR-A1 / AC-A1.1 |
| `types/index.ts` | `Transaction`, `HeliusTransaction` (транзитивна залежність парсера) | FR-A1 |
| `tests/*.json` (28 файлів) | **Golden fixtures**: реальні tx + репро-кейси багів | **AC-A1.1 → скопіювати у `packages/parser/__fixtures__/` (точна копія, 100% pass)** |
| `tests/test-transactions/Meteora/*.json` (3) | Дублікати верхніх meteora-фікстур (hash-ідентичні) — можеш використовувати тільки `tests/*.json` | опція |
| `package.json`, `docs/architecture/ARCHITECTURE.md` | Контекст версій + webhook-архітектури | орієнтир, копіювати не треба |

## Примітки
- Ця папка **не входить** у pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`), окремо не компілюється — це читання/порт, не рантайм-код.
- Debug-скрипти з оригіналу (`tests/*.cjs`, `debug_*.ts`, `fetch_*.cjs`) навмисно **не скопійовані** — частина містить hardcoded Helius API key. Для роботи по PRD вони не потрібні.
- Мапування старих шляхів PRD: `token-monitor-2/tests/*.json` → тут `tests/*.json`; `lib/parsers/*` → тут `lib/parsers/*`.
