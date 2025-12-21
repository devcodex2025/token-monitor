import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Transaction } from './types';

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

let allTransactions: Transaction[] = [];
let lastSignature: string | undefined;
let stats = {
  total: 0,
  buys: 0,
  sells: 0,
  buyVolumeSOL: 0,
  sellVolumeSOL: 0
};

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Pump.fun Token Monitor CLI...');
console.log(`Target Token: ${tokenAddress}`);
console.log('Waiting for transactions...\n');

function updateStats(tx: Transaction) {
  stats.total++;
  if (tx.type === 'BUY') {
    stats.buys++;
    if (tx.displayToken === 'SOL' || !tx.displayToken) {
      stats.buyVolumeSOL += tx.solAmount;
    }
  } else {
    stats.sells++;
    if (tx.displayToken === 'SOL' || !tx.displayToken) {
      stats.sellVolumeSOL += tx.solAmount;
    }
  }
}

function printDashboard() {
  // Build the entire output string first to avoid flicker
  let output = '';
  
  // Clear screen, scrollback and move cursor to top left
  output += '\x1b[2J\x1b[3J\x1b[H';
  
  // Header
  output += '\x1b[36m🚀 Pump.fun Token Monitor CLI\x1b[0m\n';
  output += `Target Token: ${tokenAddress}\n`;
  output += `Last Update: ${new Date().toLocaleTimeString()}\n`;
  output += '-'.repeat(110) + '\n';
  
  // Summary
  output += `Total: ${stats.total} | Buys: \x1b[32m${stats.buys}\x1b[0m | Sells: \x1b[31m${stats.sells}\x1b[0m\n`;
  output += `Buy Vol: \x1b[32m${stats.buyVolumeSOL.toFixed(2)} SOL\x1b[0m | Sell Vol: \x1b[31m${stats.sellVolumeSOL.toFixed(2)} SOL\x1b[0m | Total Vol: ${(stats.buyVolumeSOL + stats.sellVolumeSOL).toFixed(2)} SOL\n`;
  output += '-'.repeat(110) + '\n';

  // Table Header
  output += [
    'TYPE'.padEnd(6),
    'SOL AMOUNT'.padEnd(12),
    'TOKEN AMOUNT'.padEnd(15),
    'MAKER'.padEnd(15),
    'TX ID'.padEnd(10),
    'DEX'.padEnd(15),
    'DATE/TIME'
  ].join(' ') + '\n';
  output += '-'.repeat(110) + '\n';

  // Print last 20 transactions (newest first)
  const displayTxs = allTransactions.slice(0, 20);
  
  for (const parsed of displayTxs) {
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
    
    const solLabel = parsed.displayToken || 'SOL';
    const sol = `${formatSolAmount(parsed.solAmount)} ${solLabel}`.padEnd(12);
    
    const tokens = formatTokenAmount(parsed.tokenAmount, 0).padEnd(15);
    const maker = shortenAddress(parsed.wallet).padEnd(15);
    const txId = shortenAddress(parsed.signature, 4).padEnd(10);
    const dex = (parsed.dex || 'Unknown').padEnd(15);

    output += [
      type.padEnd(15), // Extra padding for color codes
      sol,
      tokens,
      maker,
      txId,
      dex,
      time
    ].join(' ') + '\n';
  }

  // Print buffer
  process.stdout.write(output);
}

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
      let hasNew = false;

      for (const tx of newTxs) {
        const parsed = parser.parse(tx, tokenAddress);
        if (parsed) {
          // Check if we already have this tx (just in case)
          if (!allTransactions.some(t => t.signature === parsed.signature)) {
            allTransactions.unshift(parsed); // Add to top
            updateStats(parsed);
            hasNew = true;
          }
        }
      }
      
      if (hasNew) {
        // Keep only last 100 in memory
        if (allTransactions.length > 100) {
          allTransactions = allTransactions.slice(0, 100);
        }
        printDashboard();
      }
    }
  } catch (error) {
    // Silent error in dashboard mode to avoid messing up UI
  }
}

// Initial poll
poll();

// Poll every 1 second
setInterval(poll, 1000);
