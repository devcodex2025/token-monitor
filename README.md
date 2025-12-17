# Pump.fun Token Monitor

Веб-додаток для моніторингу транзакцій токенів Pump.fun у реальному часі.

## Можливості

- ✅ Моніторинг транзакцій в реальному часі
- ✅ Відображення історичних транзакцій
- ✅ Візуальне розрізнення BUY/SELL
- ✅ WebSocket для миттєвого оновлення
- ✅ Інтеграція з Helius API
- ✅ Dark theme trading terminal дизайн
- ✅ Статистика транзакцій
- ✅ Посилання на Solscan explorer

## Технології

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, WebSocket (ws)
- **API**: Helius API для Solana транзакцій
- **Blockchain**: Solana Web3.js

## Швидкий старт

### 1. Встановлення залежностей

```bash
npm install
```

### 2. Налаштування змінних середовища

Створіть файл `.env.local`:

```bash
cp .env.local.example .env.local
```

Отримайте API ключ на [Helius Dashboard](https://dashboard.helius.dev/) та додайте його в `.env.local`:

```env
HELIUS_API_KEY=your_helius_api_key_here
WS_PORT=3001
```

### 3. Запуск в режимі розробки

```bash
npm run dev
```

Додаток буде доступний за адресою:
- Frontend: http://localhost:3000
- WebSocket: ws://localhost:3001

### 4. Білд для продакшну

```bash
npm run build
npm start
```

## Використання

1. **Введіть адресу токена** - Pump.fun mint address (Solana public key)
2. **Оберіть режим**:
   - **Live** - моніторинг з поточного моменту
   - **Період дат** - перегляд історичних транзакцій
3. **Натисніть "Почати моніторинг"**
4. Спостерігайте за транзакціями у реальному часі!

## Структура проекту

```
token-monitor/
├── app/
│   ├── api/
│   │   └── transactions/
│   │       └── route.ts        # API endpoint для історії транзакцій
│   ├── globals.css             # Глобальні стилі
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Головна сторінка
├── components/
│   ├── DateRangePicker.tsx     # Компонент вибору дат
│   ├── StatusBar.tsx           # Статус бар
│   ├── TokenInput.tsx          # Поле введення адреси токена
│   └── TransactionFeed.tsx     # Стрічка транзакцій
├── lib/
│   ├── helius.ts               # Helius API сервіс
│   ├── transactionParser.ts   # Парсер транзакцій
│   └── utils.ts                # Утиліти
├── types/
│   └── index.ts                # TypeScript типи
├── server.js                   # Custom Node.js + WebSocket сервер
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Особливості реалізації

### Real-time моніторинг

Додаток використовує WebSocket для отримання транзакцій у реальному часі:
- Polling кожні 2 секунди для отримання нових транзакцій
- Автоматична фільтрація дублікатів
- Підтримка множинних клієнтів

### Парсинг транзакцій

Транзакції парсяться з урахуванням:
- `tokenTransfers` - переміщення токенів
- `nativeTransfers` - переміщення SOL
- Визначення типу операції (BUY/SELL) на основі напрямку потоку

### Візуалізація

- 🟢 **BUY** - зелений колір, користувач отримує токени
- 🔴 **SELL** - червоний колір, користувач продає токени
- Плавна анімація появи нових транзакцій
- Автоматичне обмеження до 500 транзакцій в стрічці

## API Endpoints

### POST /api/transactions

Отримання історичних транзакцій.

**Request body:**
```json
{
  "tokenAddress": "string",
  "startTime": "number (timestamp)",
  "endTime": "number (timestamp)"
}
```

**Response:**
```json
{
  "success": true,
  "transactions": [...],
  "count": 10
}
```

## WebSocket Events

### Client → Server

```json
{
  "type": "subscribe",
  "tokenAddress": "token_mint_address"
}
```

### Server → Client

```json
{
  "type": "transaction",
  "transaction": {
    "id": "signature",
    "type": "BUY" | "SELL",
    "wallet": "wallet_address",
    "tokenAmount": 1000000,
    "solAmount": 50000000,
    "timestamp": 1702840800000,
    "blockTime": 1702840800
  }
}
```

## Майбутні покращення

- [ ] Фільтр за сумою транзакцій
- [ ] Звукові сповіщення для великих транзакцій
- [ ] Експорт історії транзакцій
- [ ] Графіки та аналітика
- [ ] Підтримка декількох токенів одночасно
- [ ] Авторизація користувачів
- [ ] Збереження налаштувань

## Ліцензія

MIT

## Автор

Розроблено для моніторингу токенів Pump.fun на Solana blockchain.
