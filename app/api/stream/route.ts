import { NextRequest } from 'next/server';
import { TransactionParser } from '@/lib/transactionParser';
import { WebSocketTransformer } from '@/lib/websocketTransformer';
import { getHeliusApiKeyFromRequest } from '@/lib/heliusKey';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const tokenAddress = searchParams.get('token');
  if (!tokenAddress) {
    return new Response('Token address required', { status: 400 });
  }

  // Set up Server-Sent Events with Helius WebSocket
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let heliusWs: WebSocket | null = null;
      let heartbeat: NodeJS.Timeout | null = null;

      const sendEvent = (data: any) => {
        if (isClosed) return;
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          isClosed = true;
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        
        if (heartbeat) clearInterval(heartbeat);
        
        if (heliusWs) {
          if (heliusWs.readyState === WebSocket.OPEN || heliusWs.readyState === WebSocket.CONNECTING) {
            heliusWs.close();
          }
          heliusWs = null;
        }
        
        try {
          controller.close();
        } catch (e) {
          // Ignore if already closed
        }
      };

      // Reusable handler for processing transactions
      const processTransaction = async (result: any) => {
        const t0 = performance.now();
        
        if (result.transaction) {
          // Transform WebSocket format to Enhanced format locally
          const enhanced = WebSocketTransformer.transform(result);
          
          if (!enhanced) return;
          
          const t2 = performance.now();
          
          // Parse transaction
          const parsed = TransactionParser.parse(enhanced, tokenAddress);
          
          if (parsed) {
            const t3 = performance.now();
            
            const eventData = {
              type: 'transaction',
              transaction: parsed,
              _timing: {
                transform: Math.round(t2 - t0),
                parse: Math.round(t3 - t2),
                total: Math.round(t3 - t0)
              },
              _source: 'websocket'
            };
            
            sendEvent(eventData);

            console.log(`⚡ WebSocket TX: ${parsed.type} ${parsed.solAmount} SOL in ${Math.round(t3 - t0)}ms`);
          }
        }
      };

      // Create WebSocket connection for this client
      const connectHeliusWebSocket = () => {
        const userKey = getHeliusApiKeyFromRequest(req);
        const serverKey = process.env.HELIUS_API_KEY;
        const apiKey = userKey || serverKey;
        
        console.log('🔑 WebSocket API Key Debug:', {
          hasUserKey: !!userKey,
          hasServerKey: !!serverKey,
          serverKeyLength: serverKey?.length,
          apiKeyLength: apiKey?.length
        });
        
        if (!apiKey) {
          const usingUserKey = Boolean(userKey);
          const message = usingUserKey 
            ? 'Server configuration error: Missing API Key' 
            : 'Server rate limit exceeded. Please provide your own Helius API key to continue.';
          sendEvent({ type: 'error', message, needsApiKey: !usingUserKey });
          cleanup();
          return;
        }

        const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`;
        
        console.log(`🔌 Connecting to Helius WebSocket for ${tokenAddress.slice(0, 8)}...`);
        console.log(`🔗 WebSocket URL: ${wsUrl.replace(apiKey, apiKey?.substring(0, 8) + '...')}`);
        
        try {
          heliusWs = new WebSocket(wsUrl);
          console.log('✅ WebSocket object created successfully');
        } catch (e) {
          console.error('Failed to create WebSocket:', e);
          sendEvent({ type: 'error', message: 'Failed to create WebSocket connection' });
          cleanup();
          return;
        }

        heliusWs.onopen = () => {
          console.log(`🔌 WebSocket connected for ${tokenAddress.slice(0, 8)}...`);
          
          if (heliusWs?.readyState === WebSocket.OPEN) {
            // Subscribe to transactions
            heliusWs.send(JSON.stringify({
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

            sendEvent({ 
              type: 'connected', 
              message: 'WebSocket connected - listening for transactions',
              tokenAddress: tokenAddress.slice(0, 8) + '...'
            });
          }
        };

        heliusWs.onmessage = async (event) => {
          try {
            const dataStr = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
            const response = JSON.parse(dataStr);
            
            // Handle subscription confirmation
            if (response.result) {
              console.log(`✅ Subscribed to transactions for ${tokenAddress.slice(0, 8)}...`);
              return;
            }

            // Handle transaction notification
            if (response.params?.result) {
              await processTransaction(response.params.result);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };

        heliusWs.onerror = (error) => {
          console.error('WebSocket error:', error);
          const usingUserKey = Boolean(userKey);
          let message = 'Helius WebSocket connection error';
          
          if (!usingUserKey && !serverKey) {
            message = 'Server rate limit exceeded. Please provide your own Helius API key to continue.';
          } else if (error instanceof ErrorEvent && error.message?.includes('403')) {
            message = 'WebSocket not supported by current API plan. Please upgrade your Helius plan or use historical mode instead.';
          }
          
          sendEvent({
            type: 'error',
            message,
            needsApiKey: !usingUserKey && !serverKey
          });
        };

        heliusWs.onclose = (event) => {
          console.log(`🔌 WebSocket disconnected for ${tokenAddress.slice(0, 8)}...`);
          const reason = event?.reason ? ` (${event.reason})` : '';
          sendEvent({
            type: 'error',
            message: `Helius WebSocket closed${reason}.`,
            code: event?.code,
          });
          // If upstream closes, we close the stream to trigger client reconnect
          cleanup();
        };
      };

      // Start WebSocket connection
      connectHeliusWebSocket();

      // Send initial connection confirmation
      sendEvent({ 
        type: 'connecting', 
        message: 'Connecting to Helius WebSocket...',
        tokenAddress: tokenAddress.slice(0, 8) + '...'
      });

      // Send heartbeat every 15s to keep SSE connection alive
      heartbeat = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, 15000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        cleanup();
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


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
