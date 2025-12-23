import { config } from 'dotenv';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';
import { TransactionParser } from './lib/transactionParser';
import { Transaction, HeliusTransaction } from './types';

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
                const parsed = TransactionParser.parse(tx, tokenAddress);
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
