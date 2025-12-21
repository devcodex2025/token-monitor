import { NextRequest } from 'next/server';
import WebSocket from 'ws';
import { TransactionParser } from '@/lib/transactionParser';
import { WebSocketTransformer } from '@/lib/websocketTransformer';
import { connections, websockets } from '../shared/connections';

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

      // Register this connection for receiving events
      if (!connections.has(tokenAddress)) {
        connections.set(tokenAddress, new Set());
      }
      connections.get(tokenAddress)!.add(controller);

      const sendEvent = (data: any) => {
        if (isClosed) return;
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          isClosed = true;
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
            
            // Broadcast to all clients subscribed to this token
            const tokenConnections = connections.get(tokenAddress);
            if (tokenConnections) {
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
              
              tokenConnections.forEach(ctrl => {
                try {
                  const message = `data: ${JSON.stringify(eventData)}\n\n`;
                  ctrl.enqueue(encoder.encode(message));
                } catch (err) {
                  // Client disconnected, will be cleaned up
                }
              });
            }

            console.log(`⚡ WebSocket TX: ${parsed.type} ${parsed.solAmount} SOL in ${Math.round(t3 - t0)}ms`);
          }
        }
      };

      // Create or reuse WebSocket connection for this token
      const connectHeliusWebSocket = () => {
        if (!process.env.HELIUS_API_KEY) {
          console.error('❌ HELIUS_API_KEY is missing');
          sendEvent({ type: 'error', message: 'Server configuration error: Missing API Key' });
          return;
        }

        // Check if WebSocket already exists for this token
        if (websockets.has(tokenAddress)) {
          const existingWs = websockets.get(tokenAddress)!;
          // Reuse if OPEN or CONNECTING
          if (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING) {
            console.log(`♻️ Reusing WebSocket for ${tokenAddress.slice(0, 8)}... (State: ${existingWs.readyState})`);
            
            if (existingWs.readyState === WebSocket.OPEN) {
              sendEvent({ 
                type: 'connected', 
                message: 'Connected to shared WebSocket',
                tokenAddress: tokenAddress.slice(0, 8) + '...'
              });
            }
            return; // Reuse existing connection
          } else {
            // Clean up dead WebSocket
            websockets.delete(tokenAddress);
          }
        }

        const wsUrl = `wss://atlas-mainnet.helius-rpc.com?api-key=${process.env.HELIUS_API_KEY}`;
        
        console.log(`🔌 Connecting to Helius WebSocket for ${tokenAddress.slice(0, 8)}...`);
        const heliusWs = new WebSocket(wsUrl);
        websockets.set(tokenAddress, heliusWs);

        heliusWs.on('open', () => {
          console.log(`🔌 WebSocket connected for ${tokenAddress.slice(0, 8)}...`);
          
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

          // Notify all clients
          const tokenConnections = connections.get(tokenAddress);
          if (tokenConnections) {
            const eventData = { 
              type: 'connected', 
              message: 'WebSocket connected - listening for transactions',
              tokenAddress: tokenAddress.slice(0, 8) + '...'
            };
            tokenConnections.forEach(ctrl => {
              try {
                const message = `data: ${JSON.stringify(eventData)}\n\n`;
                ctrl.enqueue(encoder.encode(message));
              } catch (err) {}
            });
          }
        });

        heliusWs.on('message', async (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString());
            
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
        });

        heliusWs.on('error', (error) => {
          console.error('WebSocket error:', error);
          sendEvent({ type: 'error', message: 'Upstream WebSocket connection failed' });
          websockets.delete(tokenAddress);
        });

        heliusWs.on('close', () => {
          console.log(`🔌 WebSocket disconnected for ${tokenAddress.slice(0, 8)}...`);
          websockets.delete(tokenAddress);
          
          // Reconnect if there are still clients
          const tokenConnections = connections.get(tokenAddress);
          if (tokenConnections && tokenConnections.size > 0) {
            console.log('Reconnecting WebSocket in 3s...');
            setTimeout(connectHeliusWebSocket, 3000);
          }
        });

        // Keep WebSocket alive
        const wsPing = setInterval(() => {
          if (heliusWs.readyState === WebSocket.OPEN) {
            heliusWs.ping();
          } else {
            clearInterval(wsPing);
          }
        }, 10000);
      };

      // Start WebSocket connection
      connectHeliusWebSocket();

      // Send initial connection confirmation
      sendEvent({ 
        type: 'connecting', 
        message: 'Connecting to Helius WebSocket...',
        tokenAddress: tokenAddress.slice(0, 8) + '...'
      });

      // Send heartbeat every 30s to keep SSE connection alive
      const heartbeat = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, 30000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(heartbeat);
        
        // Remove this connection
        const tokenConnections = connections.get(tokenAddress);
        if (tokenConnections) {
          tokenConnections.delete(controller);
          
          // If no more clients, close the WebSocket
          if (tokenConnections.size === 0) {
            connections.delete(tokenAddress);
            const ws = websockets.get(tokenAddress);
            if (ws) {
              ws.close();
              websockets.delete(tokenAddress);
              console.log(`🔴 Closed WebSocket for ${tokenAddress.slice(0, 8)}... (no clients)`);
            }
          }
        }
        
        try {
          controller.close();
        } catch (err) {
          // Already closed, ignore
        }
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
