# Solana Token Monitor

A real-time transaction tracker for Solana tokens, optimized for **Pump.fun** and **Raydium**. Monitor buys, sells, and DEX activity via a modern Web Dashboard or a lightweight CLI tool.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solana](https://img.shields.io/badge/solana-mainnet-green.svg)

## ⚡ Features

- **Real-time Monitoring**: Live transaction feed with sub-second latency.
- **Smart Parsing**: Auto-detects **BUY** vs **SELL** actions and identifies the DEX (Pump.fun, Raydium, Jupiter, etc.).
- **Dual Mode**:
  - 🖥️ **Web Dashboard**: Cyberpunk-styled UI with sound alerts, animations, and historical data.
  - 📟 **CLI Mode**: Lightweight terminal interface for headless monitoring.
- **Data Source**: Powered by [Helius RPC API](https://helius.dev/).

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Integration**: @solana/web3.js, Helius API

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repo-url>
cd token-monitor
npm install
```

### 2. Configuration
Create a `.env.local` file and add your Helius API key:
```env
HELIUS_API_KEY=your_api_key_here
```

### 3. Usage

**Web Dashboard:**
```bash
npm run dev
# Open http://localhost:3000
```

**CLI Mode:**
```bash
npm run cli <token_address>
# Example: npm run cli 6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN
```

## � Currency Conversion

The monitor automatically converts **USDC** and **USDT** transactions to **SOL equivalents** for consistent volume tracking. Original amounts are displayed in parentheses for verification.

- **Conversion Rate**: Configurable in `lib/transactionParser.ts` (default: ~$200/SOL)
- **Example Display**: `0.0050 SOL (1.00 USDC)`
- **Note**: Update `SOL_PRICE_USD` constant for accurate conversion

## �📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## 🏷️ Keywords

`solana` `blockchain` `pump.fun` `raydium` `trading-monitor` `nextjs` `typescript` `helius-api` `defi` `real-time`
