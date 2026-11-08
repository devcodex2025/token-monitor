# Token Monitor CLI Mode

This application includes a Command Line Interface (CLI) mode for monitoring token transactions directly in your terminal.

## Prerequisites

1. Ensure you have installed dependencies:
   ```bash
   npm install
   ```

2. Ensure you have a `.env` or `.env.local` file with your Helius API key:
   ```
   HELIUS_API_KEY=your_api_key_here
   ```

## Usage

To start monitoring a token, run the following command:

```bash
npm run cli <token_address>
```

### Example

```bash
npm run cli 6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN
```

## Output

The CLI will display a real-time feed of transactions with the following columns:
- **TIME**: Transaction time
- **TYPE**: BUY (Green) or SELL (Red)
- **SOL AMOUNT**: Amount of SOL involved
- **TOKEN AMOUNT**: Amount of tokens transferred
- **MAKER**: Wallet address of the user
- **DEX**: The exchange where the transaction occurred (e.g., Pump.fun, Raydium)

To stop the monitor, press `Ctrl + C`.
