# 🏗️ Architecture - Pure Webhooks Mode

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Solana Blockchain                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ Transaction occurs
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Helius Infrastructure                       │
│  • Monitors blockchain                                          │
│  • Detects matching transactions                               │
│  • Parses Enhanced Transaction data                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ Webhook POST (50-150ms)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   /api/webhook (Next.js API)                    │
│  • Receives Helius payload                                      │
│  • Parses transaction                                           │
│  • Routes to active SSE connections                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ Server-Sent Event
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   /api/stream (SSE Endpoint)                    │
│  • Maintains persistent connections                             │
│  • One connection per client per token                          │
│  • Delivers webhook data instantly                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ EventSource message
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Client (Browser)                          │
│  • Displays transaction feed                                    │
│  • Plays sound alerts                                           │
│  • Updates statistics                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Helius Webhook (`POST /api/webhook`)

**Purpose**: Receive real-time transaction notifications from Helius

**Flow**:
```typescript
1. Receive POST from Helius
2. Validate payload format
3. Extract token address from transfers
4. Parse transaction (BUY/SELL/SWAP)
5. Find active SSE connections for this token
6. Broadcast to all connected clients
7. Return success response
```

**Performance**:
- Processing: 1-5ms
- Broadcasting: <1ms per client
- Total: ~5ms internal latency

### 2. SSE Stream (`GET /api/stream?token=ADDRESS`)

**Purpose**: Maintain persistent connections with clients

**Flow**:
```typescript
1. Client connects with token address
2. Register connection in global Map
3. Send confirmation event
4. Wait for webhooks (passive)
5. Send heartbeat every 30s
6. On disconnect: cleanup and remove from Map
```

**Connection Management**:
```typescript
connections: Map<tokenAddress, Set<controller>>
```

**Events Sent**:
- `connected` - Initial connection confirmation
- `transaction` - New transaction from webhook
- `heartbeat` - Keep-alive ping
- `error` - Error messages

### 3. Client (Browser)

**Purpose**: Display real-time transaction feed

**Flow**:
```typescript
1. Connect to SSE endpoint
2. Listen for events
3. On transaction:
   - Add to state
   - Play sound
   - Update stats
   - Render in feed
4. On disconnect: auto-reconnect
```

## Data Flow

### Transaction Path

```
Blockchain → Helius (monitoring)
  ↓
Helius detects TX matching webhook filter
  ↓
Helius POST to /api/webhook
  ↓
Parse & validate payload
  ↓
Look up connections Map by token address
  ↓
Broadcast to all SSE connections for this token
  ↓
Client receives via EventSource
  ↓
UI updates immediately
```

**Total Latency**: 50-150ms from blockchain to UI

### Connection Lifecycle

```
Client opens page
  ↓
EventSource connects to /api/stream?token=X
  ↓
Server registers connection in Map
  ↓
Server sends "connected" event
  ↓
Connection stays open (passive waiting)
  ↓
Every 30s: send heartbeat
  ↓
On webhook: instant broadcast
  ↓
On client close/refresh: cleanup connection
```

## State Management

### Server-side

```typescript
// Global connection registry
connections: Map<tokenAddress, Set<ReadableStreamDefaultController>>

// Example:
{
  "6p6x...pGiPN": Set<controller1, controller2>,
  "CSrw...pump": Set<controller3>
}
```

### Client-side

```typescript
// React state
transactions: Transaction[]  // All received TXs
isMonitoring: boolean        // Connection active?
stats: {                     // Aggregated metrics
  total, buys, sells,
  buyVolume, sellVolume
}
```

## Scaling Considerations

### Horizontal Scaling

**Challenge**: Serverless functions are stateless

**Solutions**:
1. **Use Redis for connection registry** (future)
2. **Sticky sessions** (current - works on Vercel)
3. **WebSocket alternative** (if needed)

### Current Limits

- Connections per token: Unlimited
- Tokens per webhook: 100 (Helius Free)
- Concurrent clients: Vercel limits apply
- Webhook calls: Unlimited (different quota)

## Performance Metrics

### Latency Breakdown

```
Blockchain to Helius: ~10-30ms (network)
Helius processing:     ~10-20ms (parsing)
Helius to webhook:     ~20-50ms (HTTP POST)
Webhook processing:    ~1-5ms   (our code)
SSE broadcast:         <1ms     (in-memory)
Client processing:     ~5-10ms  (React render)
────────────────────────────────────────
Total:                 50-150ms
```

### Efficiency

| Metric | Value |
|--------|-------|
| API polling calls | 0 |
| Webhook overhead | ~5ms per TX |
| Memory per connection | ~1KB |
| CPU usage | Minimal (event-driven) |

## Error Handling

### Webhook Endpoint

```typescript
try {
  // Parse payload
  // Broadcast to clients
  return { success: true }
} catch (error) {
  console.error('Webhook error:', error)
  return { error: 'Invalid payload' }
}
```

### SSE Connection

```typescript
try {
  controller.enqueue(message)
} catch (err) {
  // Mark connection as closed
  // Remove from registry
  // Client will auto-reconnect
}
```

### Client Reconnection

```typescript
eventSource.onerror = (error) => {
  console.error('SSE error:', error)
  eventSource.close()
  
  // Auto-reconnect after 3s
  setTimeout(() => {
    connectWebSocket()  // Reconnect
  }, 3000)
}
```

## Security

### Webhook Validation

Currently: Trust Helius source IP (via Vercel)

**Future enhancements**:
- Webhook signature verification
- Rate limiting
- IP whitelist

### SSE Protection

- CORS configured for same-origin
- No authentication (public data)
- Rate limiting via Vercel

## Monitoring

### Key Metrics to Track

1. **Webhook delivery time**
   ```
   console.log(`🎯 Webhook delivered in ${latency}ms`)
   ```

2. **Active connections**
   ```typescript
   connections.size // Number of tokens
   Array.from(connections.values()).reduce((sum, set) => sum + set.size, 0) // Total clients
   ```

3. **Client-side latency**
   ```
   console.log(`🎯 WEBHOOK: Total ${timing.total}ms`)
   ```

### Logging

**Server logs** (Vercel):
```
🎯 Webhook delivered: BUY 0.5 SOL to 2 client(s) in 45ms
```

**Client logs** (Browser console):
```
✅ Connected - listening for webhooks on CSrwNk6B...
🎯 WEBHOOK: Receive 45ms | Parse 3ms | Total 48ms
💓 Heartbeat - connection alive
```

## Future Improvements

### Potential Enhancements

1. **Redis for connection state** (multi-region scaling)
2. **GraphQL subscriptions** (alternative to SSE)
3. **WebSocket fallback** (for older browsers)
4. **Transaction caching** (reduce Helius load)
5. **Historical data sync** (on initial connect)

### Current Limitations

1. No historical transactions on connect (webhook-only)
2. Serverless cold starts (~1-2s first request)
3. Limited to Helius webhook reliability

---

**Architecture Status**: ✅ Production Ready
**Mode**: Pure Webhooks (No Polling)
**Latency**: 50-150ms end-to-end
