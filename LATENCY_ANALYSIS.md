# Аналіз затримки Token Monitor

## Поточна архітектура

### 1. SSE Stream (route.ts)
- **Polling interval**: 1000ms (1 секунда)
- **API endpoint**: Helius Enhanced Transactions API
- **Limit**: 10 транзакцій за запит
- **Метод**: REST API polling

### 2. WebSocket Server (server.ts) - НЕ ВИКОРИСТОВУЄТЬСЯ
- **Polling interval**: 2000ms (2 секунди)
- **Status**: Код є, але не використовується в production

## Джерела затримки

### 🔴 Критичні затримки:

1. **Polling interval: 1000ms**
   - Затримка: до 1 секунди між запитами
   - Impact: Високий - основне джерело затримки

2. **Helius API response time: ~100-300ms**
   - Затримка: Network round-trip + processing
   - Impact: Середній

3. **Transaction parsing: ~1-5ms**
   - Затримка: CPU processing
   - Impact: Мінімальний

4. **React state updates: ~5-16ms**
   - Затримка: React rendering cycle
   - Impact: Низький

### Загальна затримка: **1.1 - 1.5 секунд**

---

## Рішення для мінімізації до мілісекунд

### ✅ Рішення 1: Helius Webhooks (НАЙКРАЩЕ)

**Затримка: ~50-200ms**

```typescript
// Використовувати Helius Enhanced Webhooks
// https://docs.helius.dev/webhooks-and-websockets/what-are-webhooks

// 1. Створити webhook endpoint
POST /api/webhook

// 2. Налаштувати Helius webhook для token
{
  "webhookURL": "https://your-domain.com/api/webhook",
  "transactionTypes": ["SWAP"],
  "accountAddresses": [tokenAddress],
  "webhookType": "enhanced"
}

// 3. Отримувати транзакції миттєво при їх виникненні
```

**Переваги:**
- ✅ Real-time (~50-200ms затримка)
- ✅ Немає polling - економія на API calls
- ✅ Миттєве оновлення UI

**Недоліки:**
- ❌ Потребує публічний endpoint (Vercel підтримує)
- ❌ Складніша конфігурація

---

### ✅ Рішення 2: Helius WebSocket (ДОБРЕ)

**Затримка: ~100-300ms**

```typescript
// Використовувати Helius WebSocket API
import WebSocket from 'ws';

const ws = new WebSocket('wss://atlas-mainnet.helius-rpc.com');

ws.on('open', () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'accountSubscribe',
    params: [
      tokenAddress,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed'
      }
    ]
  }));
});

ws.on('message', (data) => {
  // Отримуємо транзакцію миттєво
});
```

**Переваги:**
- ✅ Real-time (~100-300ms)
- ✅ Bidirectional communication
- ✅ Підтримується Helius

**Недоліки:**
- ❌ Складніше налаштування з Next.js
- ❌ Потребує WebSocket server

---

### ✅ Рішення 3: Зменшення polling interval (ШВИДКЕ)

**Затримка: ~200-400ms**

```typescript
// В route.ts змінити на 200ms
const interval = setInterval(poll, 200);
```

**Переваги:**
- ✅ Легко імплементувати (1 рядок коду)
- ✅ Працює з поточною архітектурою
- ✅ Значно швидше

**Недоліки:**
- ❌ 5x більше API calls (може бути дорожче)
- ❌ Більше навантаження на API

---

### ✅ Рішення 4: gRPC/Transaction Stream (ОПТИМАЛЬНО)

**Затримка: ~50-150ms**

```typescript
// Helius gRPC subscription
import { Client } from '@triton-one/yellowstone-grpc';

const client = new Client(
  'https://api.helius.dev/v0/...',
  undefined,
  { 'x-token': HELIUS_API_KEY }
);

await client.subscribe({
  accounts: {
    token: {
      account: [tokenAddress],
      owner: [],
      filters: []
    }
  },
  transactions: {
    vote: false,
    failed: false,
    accountInclude: [tokenAddress]
  }
});

client.on('update', (update) => {
  // Real-time transaction updates
});
```

**Переваги:**
- ✅ Найшвидше (~50-150ms)
- ✅ Efficient streaming protocol
- ✅ Підтримується великими RPC

**Недоліки:**
- ❌ Складна інтеграція
- ❌ Може не підтримуватись Helius

---

## Рекомендації

### 🎯 Короткострокове рішення (5 хвилин):
```typescript
// route.ts, line 53
const interval = setInterval(poll, 200); // Було 1000
```
**Результат: 1.5s → 0.3-0.5s**

### 🎯 Середньострокове рішення (1-2 години):
Імплементувати Helius Webhooks
**Результат: 1.5s → 0.05-0.2s**

### 🎯 Довгострокове рішення (1 день):
Мігрувати на gRPC streaming
**Результат: 1.5s → 0.05-0.15s**

---

## Додаткові оптимізації

### 1. Оптимізація React rendering
```typescript
// Використовувати useMemo для transactions
const sortedTransactions = useMemo(() => {
  return [...transactions].sort((a, b) => b.blockTime - a.blockTime);
}, [transactions]);
```

### 2. Віртуалізація списку
```typescript
// Використовувати react-window для великих списків
import { FixedSizeList } from 'react-window';
```

### 3. Debouncing state updates
```typescript
// Групувати оновлення за 100ms
const debouncedUpdate = useMemo(
  () => debounce((txs) => setTransactions(txs), 100),
  []
);
```

### 4. Web Workers для parsing
```typescript
// Парсити транзакції у background thread
const worker = new Worker('/parser-worker.js');
```

---

## Вимірювання затримок

```typescript
// Додати timestamping
const t1 = performance.now();
// API call
const t2 = performance.now();
console.log(`API: ${t2 - t1}ms`);

// Parsing
const t3 = performance.now();
console.log(`Parse: ${t3 - t2}ms`);

// Render
const t4 = performance.now();
console.log(`Render: ${t4 - t3}ms`);
```
