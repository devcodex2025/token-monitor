import { config } from 'dotenv';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';

// Load environment variables
config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
const wsPort = 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Client {
  ws: WebSocket;
  tokenAddress?: string;
}

interface HeliusTransaction {
  signature: string;
  timestamp: number;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

interface ParsedTransaction {
  id: string;
  signature: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  tokenAmount: number;
  solAmount: number;
  displayToken?: string;
  timestamp: number;
  blockTime: number;
}

const clients = new Set<Client>();
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    
    const client: Client = { ws };
    clients.add(client);

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe' && data.tokenAddress) {
          client.tokenAddress = data.tokenAddress;
          console.log(`Client subscribed to token: ${data.tokenAddress}`);
          
          // Start polling for this token
          startPolling(client);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(client);
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      clients.delete(client);
    });
  });

  // Polling mechanism
  const pollingIntervals = new Map<string, NodeJS.Timeout>();
  const lastSignatures = new Map<string, string>();
  
  async function startPolling(client: Client) {
    if (!client.tokenAddress) return;
    
    const tokenAddress = client.tokenAddress;
    
    // Don't create duplicate polling for the same token
    if (pollingIntervals.has(tokenAddress)) return;
    
    const poll = async () => {
      try {
        // Use Enhanced Transactions API
        const response = await axios.get(
          `https://api-mainnet.helius-rpc.com/v0/addresses/${tokenAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=5`
        );

        const transactions = response.data || [];
        
        if (transactions.length > 0) {
          const lastSignature = lastSignatures.get(tokenAddress);
          
          // Only get new transactions
          const newTransactions = lastSignature
            ? transactions.filter(
                (tx: any, idx: number) => 
                  idx < transactions.findIndex((t: any) => t.signature === lastSignature)
              )
            : [transactions[0]]; // First time, only send the latest

          lastSignatures.set(tokenAddress, transactions[0].signature);

          // Send to all clients monitoring this token
          for (const c of clients) {
            if (c.tokenAddress === tokenAddress && c.ws.readyState === WebSocket.OPEN) {
              for (const tx of newTransactions) {
                const parsed = parseTransaction(tx, tokenAddress);
                if (parsed) {
                  c.ws.send(JSON.stringify({
                    type: 'transaction',
                    transaction: parsed,
                  }));
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(poll, 2000);
    pollingIntervals.set(tokenAddress, interval);
    
    // Initial poll
    poll();
  }

  function parseTransaction(heliusTx: HeliusTransaction, tokenMint: string): ParsedTransaction | null {
    try {
      const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx;

      if (!tokenTransfers || tokenTransfers.length === 0) {
        return null;
      }

      const tokenTransfer = tokenTransfers.find(
        (transfer) => transfer.mint === tokenMint
      );

      if (!tokenTransfer) {
        return null;
      }

      // Simple swap direction logic:
      // BUY = any token X → our token (someone receives our token)
      // SELL = our token → any token X (someone sends our token)
      // We don't care about buyer/seller addresses, only swap direction
      
      const toAccount = tokenTransfer.toUserAccount;
      const fromAccount = tokenTransfer.fromUserAccount;
      
      const isToUser = isUserAccount(toAccount);
      const isFromUser = isUserAccount(fromAccount);
      
      let isBuy: boolean;
      let wallet: string;
      
      // Primary logic: check if real user is receiving or sending our token
      if (isToUser && !isFromUser) {
        // User receives our token = BUY
        isBuy = true;
        wallet = toAccount;
      } else if (isFromUser && !isToUser) {
        // User sends our token = SELL
        isBuy = false;
        wallet = fromAccount;
      } else {
        // Fallback: look at opposite token flow direction
        // If opposite token flows FROM toAccount → toAccount is buying (BUY)
        // If opposite token flows TO toAccount → toAccount is selling (SELL)
        
        let hasOppositeFrom = false;
        let hasOppositeTo = false;
        
        // Check SOL transfers
        if (nativeTransfers && nativeTransfers.length > 0) {
          for (const transfer of nativeTransfers) {
            if (transfer.fromUserAccount === toAccount) hasOppositeFrom = true;
            if (transfer.toUserAccount === toAccount) hasOppositeTo = true;
          }
        }
        
        // Check other token transfers
        if (tokenTransfers && tokenTransfers.length > 1) {
          for (const transfer of tokenTransfers) {
            if (transfer.mint !== tokenMint) {
              if (transfer.fromUserAccount === toAccount) hasOppositeFrom = true;
              if (transfer.toUserAccount === toAccount) hasOppositeTo = true;
            }
          }
        }
        
        // Determine direction based on opposite flow
        if (hasOppositeFrom && !hasOppositeTo) {
          // Other asset leaves toAccount, our token arrives = BUY
          isBuy = true;
          wallet = toAccount;
        } else if (hasOppositeTo && !hasOppositeFrom) {
          // Other asset arrives toAccount, our token leaves = SELL
          isBuy = false;
          wallet = fromAccount;
        } else {
          // Default to BUY if unclear
          isBuy = true;
          wallet = toAccount;
        }
      }

      // Find SOL transfer amount or other token (USDC, USDT, etc)
      let solAmount = 0;
      let displayToken = 'SOL';
      
      if (nativeTransfers && nativeTransfers.length > 0) {
        // For BUY: user sends SOL (fromUserAccount)
        // For SELL: user receives SOL (toUserAccount)
        const relevantTransfer = nativeTransfers.find(
          (transfer) => {
            if (isBuy) {
              return transfer.fromUserAccount === wallet;
            } else {
              return transfer.toUserAccount === wallet;
            }
          }
        );
        
        if (relevantTransfer) {
          solAmount = relevantTransfer.amount;
        } else {
          // Fallback: find any SOL transfer related to this wallet
          const anyTransfer = nativeTransfers.find(
            (transfer) =>
              transfer.fromUserAccount === wallet || transfer.toUserAccount === wallet
          );
          if (anyTransfer) {
            solAmount = anyTransfer.amount;
          }
        }
      }
      
      // If no SOL amount found or it's zero, look for other token transfers (USDC, USDT, etc)
      if (solAmount === 0 && tokenTransfers && tokenTransfers.length > 1) {
        // Find the opposite token transfer (the one that's NOT our token)
        const otherTokenTransfer = tokenTransfers.find(
          (transfer) => transfer.mint !== tokenMint && (
            (isBuy && transfer.fromUserAccount === wallet) ||
            (!isBuy && transfer.toUserAccount === wallet)
          )
        );
        
        if (otherTokenTransfer) {
          solAmount = otherTokenTransfer.tokenAmount;
          // Try to identify the token symbol
          const knownTokens: Record<string, string> = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'So11111111111111111111111111111111111111112': 'SOL',
          };
          displayToken = knownTokens[otherTokenTransfer.mint] || 'TOKEN';
        }
      }

      return {
        id: signature,
        signature,
        type: isBuy ? 'BUY' : 'SELL',
        wallet,
        tokenAmount: tokenTransfer.tokenAmount,
        solAmount,
        displayToken,
        timestamp: Date.now(),
        blockTime: timestamp,
      };
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  function isUserAccount(address: string): boolean {
    const knownPrograms = [
      '11111111111111111111111111111111',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    ];
    
    return !knownPrograms.includes(address);
  }

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server running on ws://${hostname}:${wsPort}`);
  });

  // Cleanup on exit
  process.on('SIGTERM', () => {
    pollingIntervals.forEach((interval) => clearInterval(interval));
    wss.close();
    process.exit(0);
  });
});
