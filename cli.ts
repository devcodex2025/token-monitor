import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
// Fallback to .env if .env.local doesn't exist or doesn't have the key
if (!process.env.HELIUS_API_KEY) {
  dotenv.config();
}

import { HeliusService } from './lib/helius';
import { TransactionParser } from './lib/transactionParser';
import { formatDateTime, formatTokenAmount, formatSolAmount, shortenAddress } from './lib/utils';

const apiKey = process.env.HELIUS_API_KEY;

if (!apiKey) {
  console.error('❌ Error: HELIUS_API_KEY not found in .env file');
  process.exit(1);
}

const tokenAddress = process.argv[2];

if (!tokenAddress) {
  console.error('❌ Error: Please provide a token address');
  console.log('Usage: npm run cli <token_address>');
  process.exit(1);
}

const helius = new HeliusService(apiKey);
const parser = TransactionParser;

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Token Monitor CLI...');
console.log(`Target Token: ${tokenAddress}`);
console.log('Waiting for transactions...\n');

// Header
console.log(
  '%s %s %s %s %s %s',
  'TYPE'.padEnd(6),
  'SOL AMOUNT'.padEnd(12),
  'TOKEN AMOUNT'.padEnd(15),
  'MAKER'.padEnd(15),
  'DEX'.padEnd(15),
  'DATE/TIME'
);
console.log('-'.repeat(90));

let lastSignature: string | undefined;

async function poll() {
  try {
    const response = await helius.getTransactionHistory(tokenAddress, {
      until: lastSignature,
      limit: 10
    });

    if (response && response.length > 0) {
      // Update last signature to the most recent one
      lastSignature = response[0].signature;

      // Process transactions (newest first)
      const newTxs = response;

      for (const tx of newTxs) {
        const parsed = parser.parse(tx, tokenAddress);
        if (parsed) {
          // Compact date format: DD/MM HH:mm:ss
          const date = new Date(parsed.blockTime * 1000);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          const time = `${day}/${month} ${hours}:${minutes}:${seconds}`;

          const typeColor = parsed.type === 'BUY' ? '\x1b[32m' : '\x1b[31m'; // Green or Red
          const resetColor = '\x1b[0m';
          const type = `${typeColor}${parsed.type}${resetColor}`;
          const sol = formatSolAmount(parsed.solAmount).padEnd(12);
          // tokenAmount is already adjusted for decimals from Helius, so we pass 0 decimals to formatter
          const tokens = formatTokenAmount(parsed.tokenAmount, 0).padEnd(15);
          const maker = shortenAddress(parsed.wallet).padEnd(15);
          const dex = (parsed.dex || 'Unknown').padEnd(15);

          console.log(
            '%s %s %s %s %s %s',
            type.padEnd(15), // Extra padding for color codes
            sol,
            tokens,
            maker,
            dex,
            time
          );
        }
      }
    }
  } catch (error) {
    // Silent error in loop to avoid spam
  }

  setTimeout(poll, 3000);
}

// Start polling
poll();
