# Token Monitor ([$TMR](https://bags.fm/AUJgYtx8hif6tWxd79hGdwiitKMxsVRrSpz8hT4uBAGS))

A real-time transaction tracker for Solana tokens, powered by **Helius Webhooks**. Monitor buys, sells, and DEX activity with **zero latency** via instant push notifications.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

![Token Monitor preview](/public/Token_Monitor_preview.png "Token Monitor preview")

## ⚡ Features

- **Real-time Webhooks**: Instant transaction notifications with 50-150ms latency
- **Zero Polling**: No API calls overhead - pure push architecture
- **Smart Parsing**: Auto-detects **BUY** vs **SELL** and identifies DEX (Pump.fun, Raydium, Jupiter, etc.)
- **Dual Mode**:
  - 🖥️ **Web Dashboard**: Cyberpunk-styled UI with sound alerts and animations
  - 📟 **CLI Mode**: Lightweight terminal interface
- **Data Source**: Powered by [Helius Webhooks](https://docs.helius.dev/webhooks-and-websockets/webhooks)

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repo-url>
cd token-monitor
npm install
```

### 2. Configuration
Create a `.env.local` file:
```env
HELIUS_API_KEY=your_api_key_here
WEBHOOK_URL=https://your-domain.vercel.app/api/webhook
```

### 3. Deploy to Vercel
```bash
npm install -g vercel
vercel deploy --prod
```

### 4. Create Helius Webhook

**Via Dashboard:**
1. Visit https://dashboard.helius.dev/webhooks
2. Create Webhook → Enhanced Transactions
3. URL: `https://your-domain.vercel.app/api/webhook`
4. Types: `SWAP`, `TRANSFER`
5. Add token addresses

**Via CLI:**
```bash
npm run webhook create <TOKEN_ADDRESS>
npm run webhook list
npm run webhook delete <WEBHOOK_ID>
```

### 5. Start Monitoring

Open your Vercel URL and start tracking transactions in real-time!

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Real-time**: Server-Sent Events (SSE) + Helius Webhooks
- **Integration**: @solana/web3.js, Helius API

## 📊 Architecture

```
Solana → Helius → Webhook (50ms) → SSE → UI
```

**Pure webhook-based** - no polling, no delays!

### Performance:
- **Latency**: 50-150ms from blockchain to UI
- **API Calls**: 0 (webhooks only)
- **Efficiency**: 100% (receive only real transactions)

**Read more**: [ARCHITECTURE.md](ARCHITECTURE.md)

## 📚 Community and support

The project has own token - [$TMR](https://bags.fm/AUJgYtx8hif6tWxd79hGdwiitKMxsVRrSpz8hT4uBAGS)
Token listed on [Bags.fm](https://bags.fm/AUJgYtx8hif6tWxd79hGdwiitKMxsVRrSpz8hT4uBAGS)  
![Bags.fm logo](public/bags-logo_32px.png) ![Token Monitor logo](public/pump-monitor-logo-opt_64x32.webp)

## 💸 Currency Conversion

The monitor automatically converts **USDC** and **USDT** transactions to **SOL equivalents** for consistent volume tracking. Original amounts are displayed in parentheses for verification.

- **Conversion Rate**: Configurable in `lib/transactionParser.ts` (default: ~$200/SOL)
- **Example Display**: `0.0050 SOL (1.00 USDC)`
- **Note**: Update `SOL_PRICE_USD` constant for accurate conversion

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## 🏷️ Keywords

`solana` `blockchain` `pump.fun` `raydium` `trading-monitor` `nextjs` `typescript` `helius-api` `defi` `real-time`
