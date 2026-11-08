// Use globalThis to persist connections across HMR reloads in development
const globalForConnections = globalThis as unknown as {
  connections: Map<string, Set<ReadableStreamDefaultController>>;
  websockets: Map<string, any>;
};

// Shared WebSocket connections store for stream and webhook routes
export const connections = globalForConnections.connections || new Map<string, Set<ReadableStreamDefaultController>>();

// Map to store shared WebSocket connections for each token
export const websockets = globalForConnections.websockets || new Map<string, any>();

if (process.env.NODE_ENV !== 'production') {
  globalForConnections.connections = connections;
  globalForConnections.websockets = websockets;
}
