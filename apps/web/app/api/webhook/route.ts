import { NextRequest, NextResponse } from 'next/server';
import { TransactionParser } from '@/lib/transactionParser';
import { connections } from '../shared/connections';

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  
  try {
    const data = await req.json();
    const t1 = performance.now();
    
    // Helius webhook payload
    if (Array.isArray(data) && data[0]?.type === 'ENHANCED') {
      let sentCount = 0;
      
      for (const event of data) {
        const tokenAddress = event.tokenTransfers?.[0]?.mint;
        if (!tokenAddress) continue;

        const parsed = TransactionParser.parse(event, tokenAddress);
        if (!parsed) continue;

        const t2 = performance.now();
        
        // Send to all active connections monitoring this token
        const controllers = connections.get(tokenAddress);
        if (controllers && controllers.size > 0) {
          const message = JSON.stringify({ 
            type: 'transaction', 
            transaction: parsed,
            _timing: {
              receive: Math.round(t1 - t0),
              parse: Math.round(t2 - t1),
              total: Math.round(t2 - t0)
            },
            _source: 'webhook'
          });
          
          const encoder = new TextEncoder();
          const encoded = encoder.encode(`data: ${message}\n\n`);
          
          controllers.forEach(controller => {
            try {
              controller.enqueue(encoded);
              sentCount++;
            } catch (err) {
              console.error('Failed to send to client:', err);
            }
          });
          
          console.log(`🎯 Webhook delivered: ${parsed.type} ${parsed.solAmount} SOL to ${controllers.size} client(s) in ${Math.round(t2 - t0)}ms`);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        processed: data.length,
        sent: sentCount,
        latency: Math.round(performance.now() - t0)
      });
    }

    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
