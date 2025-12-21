import WebSocket from 'ws';

// Shared WebSocket connections store for stream and webhook routes
export const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Map to store shared WebSocket connections for each token
export const websockets = new Map<string, WebSocket>();
