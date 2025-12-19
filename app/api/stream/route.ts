import { NextRequest } from 'next/server';
import { HeliusService } from '@/lib/helius';
import { TransactionParser } from '@/lib/transactionParser';

const helius = new HeliusService(process.env.HELIUS_API_KEY || '');
const parser = TransactionParser;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const tokenAddress = searchParams.get('token');

  if (!tokenAddress) {
    return new Response('Token address required', { status: 400 });
  }

  // Set up Server-Sent Events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastSignature: string | undefined;

      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Polling interval
      const poll = async () => {
        const t1 = performance.now();
        try {
          const response = await helius.getTransactionHistory(tokenAddress, {
            until: lastSignature,
            limit: 10
          });
          
          const t2 = performance.now();
          const apiTime = Math.round(t2 - t1);
          
          if (response && response.length > 0) {
            // Update last signature to the most recent one (first in list)
            lastSignature = response[0].signature;
            
            // Parse and send new transactions
            for (const tx of response) {
              const parsed = parser.parse(tx, tokenAddress);
              if (parsed) {
                const t3 = performance.now();
                const parseTime = Math.round(t3 - t2);
                sendEvent({ 
                  type: 'transaction', 
                  transaction: parsed,
                  _timing: { api: apiTime, parse: parseTime, total: Math.round(t3 - t1) }
                });
              }
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
          sendEvent({ type: 'error', message: 'Failed to fetch transactions' });
        }
      };

      // Initial poll
      await poll();

      // Poll every 200ms for minimal latency (5x per second)
      // This provides ~200-400ms total latency vs 1000-1500ms before
      const interval = setInterval(poll, 200);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
