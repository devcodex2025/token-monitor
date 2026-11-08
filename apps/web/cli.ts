import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { Transaction } from './types';
import { HeliusService } from './lib/helius';
import { TransactionParser } from './lib/transactionParser';
import { WebSocketTransformer } from './lib/websocketTransformer';
import { formatTokenAmount, formatSolAmount, shortenAddress } from './lib/utils';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
if (!process.env.HELIUS_API_KEY) {
  dotenv.config();
}

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

// Wallet Stats Tracking
interface WalletStats {
  txCount: number;
  buyVolume: number;
  sellVolume: number;
}

const walletStats = new Map<string, WalletStats>();
let allTransactions: Transaction[] = [];

// Global Session Stats
let sessionStats = {
  buyVolume: 0,
  sellVolume: 0
};
let isFirstRender = true;

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Pump.fun Token Monitor CLI (Fast Mode)...');
console.log(`Target Token: ${tokenAddress}`);
console.log('Connecting to Helius WebSocket...\n');

function updateWalletStats(tx: Transaction) {
  const wallet = tx.wallet;
  if (!walletStats.has(wallet)) {
    walletStats.set(wallet, { txCount: 0, buyVolume: 0, sellVolume: 0 });
  }
  
  const stats = walletStats.get(wallet)!;
  stats.txCount++;
  
  if (tx.type === 'BUY') {
    stats.buyVolume += tx.solAmount;
    sessionStats.buyVolume += tx.solAmount;
  } else if (tx.type === 'SELL') {
    stats.sellVolume += tx.solAmount;
    sessionStats.sellVolume += tx.solAmount;
  }
  
  return stats;
}

function printDashboard() {
  let output = '';
  if (isFirstRender) {
    output += '\x1b[2J';
    isFirstRender = false;
  }
  
  // Move cursor to top-left (H)
  output += '\x1b[H';
  
  // Header
  output += '\x1b[36m🚀 Pump.fun Token Monitor CLI\x1b[0m\x1b[K\n';
  output += `Target Token: ${tokenAddress}\x1b[K\n`;
  output += `Last Update: ${new Date().toLocaleTimeString()}\x1b[K\n`;
  output += '-'.repeat(100) + '\x1b[K\n';
  
  const center = (str: string, width: number) => {
    let visualLen = str.length;
    // Adjust for wide characters (icons)
    if (str.includes('⭐')) visualLen += 1;
    if (str.includes('●')) visualLen += 1;
    
    if (visualLen >= width) return str;
    const left = Math.floor((width - visualLen) / 2);
    return ' '.repeat(left) + str + ' '.repeat(width - visualLen - left);
  };

  // Table Header
  const headers = [
    center('TIME', 10),
    center('#', 4),
    center('TYPE', 8),
    center('SOL AMT', 10),
    center('NET INV', 10),
    center('TOT BUY', 10),
    center('DEX', 14),
    center('WALLET', 14),
    center('BALANCE', 10)
  ];
  
  output += headers.join(' ') + '\x1b[K\n';
  output += '-'.repeat(100) + '\x1b[K\n';

  // Print last 20 transactions (newest at bottom)
  const displayTxs = allTransactions.slice(0, 20).reverse();
  
  for (const tx of displayTxs) {
    const stats = walletStats.get(tx.wallet) || { txCount: 0, buyVolume: 0, sellVolume: 0 };
    const sessStats = (tx as any).sessionStats || { buyVolume: 0, sellVolume: 0 };
    
    // 1. Time
    const date = new Date(tx.blockTime * 1000);
    const time = date.toLocaleTimeString('en-GB', { hour12: false }); // HH:mm:ss
    
    // 2. Wallet Tx Count
    let txCountDisplay = '';
    const txNum = (tx as any).txNumber || 0;
    if (txNum === 1) {
      txCountDisplay = '⭐';
    } else {
      txCountDisplay = txNum.toString();
    }

    // 3. Type & Color
    const isBuy = tx.type === 'BUY';
    const color = isBuy ? '\x1b[32m' : '\x1b[31m'; // Green : Red
    const type = `● ${tx.type}`;

    // 4. SOL Amount
    const solAmt = formatSolAmount(tx.solAmount);

    // 5. Remaining Investment (Net Invested)
    const netInvested = stats.buyVolume - stats.sellVolume;
    const netInvestedStr = (netInvested >= 0 ? ' ' : '') + formatSolAmount(netInvested);

    // 6. Total Buy Vol
    const totalBuyVol = formatSolAmount(stats.buyVolume);

    // 7. DEX
    const dex = (tx.dex || 'Unknown').slice(0, 15);

    // Wallet (Extra)
    const wallet = shortenAddress(tx.wallet);

    // Session Stats Columns
    const sessNet = sessStats.buyVolume - sessStats.sellVolume;
    const sessNetStr = (sessNet >= 0 ? ' ' : '') + formatSolAmount(sessNet);
    const sessColor = sessNet >= 0 ? '\x1b[32m' : '\x1b[31m';

    const row = [
      center(time, 10),
      center(txCountDisplay, 4),
      center(type, 8),
      center(solAmt, 10),
      center(netInvestedStr, 10),
      center(totalBuyVol, 10),
      center(dex, 14),
      center(wallet, 14),
      `${sessColor}${center(sessNetStr, 10)}\x1b[0m${color}` // Reset to row color
    ].join(' ');

    output += `${color}${row}\x1b[0m\x1b[K\n`;
  }

  output += '-'.repeat(100) + '\x1b[K\n';
  
  // Footer: Wallet Balance
  if (allTransactions.length === 0) {
    output += 'Waiting for transactions...\x1b[K\n';
  }

  // Clear from cursor to end of screen (J) to remove any leftover text from previous render
  output += '\x1b[J';

  process.stdout.write(output);
}

function connectWebSocket() {
  const wsUrl = `wss://atlas-mainnet.helius-rpc.com?api-key=${apiKey}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('✅ Connected to Helius WebSocket');
    
    // Subscribe
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'transactionSubscribe',
      params: [
        { failed: false, accountInclude: [tokenAddress] },
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          transactionDetails: 'full',
          maxSupportedTransactionVersion: 0
        }
      ]
    }));
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle subscription confirmation
      if (message.result !== undefined && !message.params) {
        console.log(`✅ Subscribed to ${tokenAddress}`);
        // Initial render of empty dashboard
        setTimeout(printDashboard, 1500);
        return;
      }

      // Handle transaction
      if (message.params?.result) {
        const enhanced = WebSocketTransformer.transform(message.params.result);
        if (enhanced) {
          const parsed = TransactionParser.parse(enhanced, tokenAddress);
          
          if (parsed) {
             if (parsed.type === 'BUY' || parsed.type === 'SELL') {
                // Update stats
                const stats = updateWalletStats(parsed);
                
                // Attach txNumber for display
                (parsed as any).txNumber = stats.txCount;
                
                // Attach session stats snapshot
                (parsed as any).sessionStats = { ...sessionStats };

                // Add to list
                allTransactions.unshift(parsed);
                if (allTransactions.length > 50) {
                  allTransactions.pop();
                }

                // Update UI
                printDashboard();
             } else {
               // console.log(`Skipped ${parsed.type} transaction`);
             }
          }
        }
      }
    } catch (error) {
      // console.error('Error processing message:', error);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  });
}

// Start
connectWebSocket();
