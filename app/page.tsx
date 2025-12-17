'use client';

import { useState, useEffect, useRef } from 'react';
import { validateSolanaAddress } from '@/lib/utils';
import TokenInput from '@/components/TokenInput';
import DateRangePicker from '@/components/DateRangePicker';
import TransactionFeed from '@/components/TransactionFeed';
import StatusBar from '@/components/StatusBar';
import { Transaction, TokenMonitorConfig } from '@/types';

export default function Home() {
  const [config, setConfig] = useState<TokenMonitorConfig>({
    tokenAddress: '',
    mode: 'live',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, buys: 0, sells: 0 });
  
  const wsRef = useRef<WebSocket | null>(null);

  // Load saved token address from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('lastTokenAddress');
    if (savedAddress) {
      setConfig((prev) => ({ ...prev, tokenAddress: savedAddress }));
    }
  }, []);

  const startMonitoring = async () => {
    if (!validateSolanaAddress(config.tokenAddress)) {
      setError('Invalid token address');
      return;
    }

    // Save token address to localStorage
    localStorage.setItem('lastTokenAddress', config.tokenAddress);

    setIsLoading(true);
    setError(null);
    setTransactions([]);

    try {
      // Fetch historical transactions if "all" mode
      if (config.mode === 'all') {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: config.tokenAddress,
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const data = await response.json();
        setTransactions(data.transactions || []);
      }

      // Connect to WebSocket
      connectWebSocket();
      setIsMonitoring(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsMonitoring(false);
  };

  const connectWebSocket = () => {
    // Use Server-Sent Events for Vercel compatibility
    const eventSource = new EventSource(`/api/stream?token=${encodeURIComponent(config.tokenAddress)}`);
    
    eventSource.onopen = () => {
      console.log('SSE connected');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'transaction') {
        const newTx = data.transaction as Transaction;
        setTransactions((prev) => {
          const updated = [newTx, ...prev];
          // Keep max 500 transactions
          return updated.slice(0, 500);
        });
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      setError('Connection error');
    };

    // Store as any to reuse wsRef
    wsRef.current = eventSource as any;
  };

  useEffect(() => {
    // Calculate stats
    const buys = transactions.filter((tx) => tx.type === 'BUY').length;
    const sells = transactions.filter((tx) => tx.type === 'SELL').length;
    setStats({ total: transactions.length, buys, sells });
  }, [transactions]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-terminal-success to-terminal-warning bg-clip-text text-transparent">
            Pump.fun Token Monitor
          </h1>
          <p className="text-terminal-muted">
            Real-time token transaction monitoring
          </p>
        </div>

        {/* Control Panel */}
        <div className="terminal-panel p-6 mb-6">
          <div className="space-y-4">
            <TokenInput
              value={config.tokenAddress}
              onChange={(address) =>
                setConfig((prev) => ({ ...prev, tokenAddress: address }))
              }
              disabled={isMonitoring}
            />

            <DateRangePicker
              mode={config.mode}
              onModeChange={(mode) =>
                setConfig((prev) => ({ ...prev, mode }))
              }
              disabled={isMonitoring}
            />

            {error && (
              <div className="text-terminal-danger text-sm bg-terminal-danger/10 border border-terminal-danger/30 rounded px-4 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              {!isMonitoring ? (
                <button
                  onClick={startMonitoring}
                  disabled={isLoading || !config.tokenAddress}
                  className="terminal-button-primary"
                >
                  {isLoading ? 'Loading...' : 'Start Monitoring'}
                </button>
              ) : (
                <button
                  onClick={stopMonitoring}
                  className="terminal-button-danger"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          isMonitoring={isMonitoring}
          tokenAddress={config.tokenAddress}
          stats={stats}
        />

        {/* Transaction Feed */}
        <TransactionFeed transactions={transactions} />
      </div>
    </main>
  );
}
