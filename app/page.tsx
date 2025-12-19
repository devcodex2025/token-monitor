'use client';

import { useState, useEffect, useRef } from 'react';
import { validateSolanaAddress } from '@/lib/utils';
import TokenInput from '@/components/TokenInput';
import DateRangePicker from '@/components/DateRangePicker';
import TransactionFeed from '@/components/TransactionFeed';
import StatusBar from '@/components/StatusBar';
import { Transaction, TokenMonitorConfig } from '@/types';
import Image from 'next/image';

export default function Home() {
  const [config, setConfig] = useState<TokenMonitorConfig>({
    tokenAddress: '',
    mode: 'live',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ 
    total: 0, 
    buys: 0, 
    sells: 0,
    buyVolumeSOL: 0,
    sellVolumeSOL: 0,
    totalVolumeSOL: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const loadMore = async () => {
    if (transactions.length === 0 || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const lastTx = transactions[transactions.length - 1];
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: config.tokenAddress,
          before: lastTx.signature,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch more transactions');

      const data = await response.json();
      const newTransactions = data.transactions || [];

      if (newTransactions.length > 0) {
        setTransactions((prev) => [...prev, ...newTransactions]);
      }
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const stopMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsMonitoring(false);
  };

  const connectWebSocket = () => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Use Server-Sent Events for Vercel compatibility
    const eventSource = new EventSource(`/api/stream?token=${encodeURIComponent(config.tokenAddress)}`);

    eventSource.onopen = () => {
      console.log('SSE connected');
      setError(null); // Clear error on successful connection
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'transaction') {
        const newTx = data.transaction as Transaction;
        
        // Log timing information for latency monitoring
        if (data._timing) {
          console.log(`⏱️ Latency: API ${data._timing.api}ms | Parse ${data._timing.parse}ms | Total ${data._timing.total}ms`);
        }
        
        setTransactions((prev) => {
          // Check if transaction already exists to avoid duplicates
          if (prev.some(tx => tx.signature === newTx.signature)) {
            return prev;
          }
          const updated = [newTx, ...prev];
          // Keep max 2000 transactions to allow for history loading
          return updated.slice(0, 2000);
        });
      } else if (data.type === 'error') {
        // Don't stop monitoring on error, just show it
        console.error('Stream error:', data.message);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      
      // Only reconnect if we are supposed to be monitoring
      // We check the ref or state. Since this closure captures state, we need to be careful.
      // However, if stopMonitoring is called, we clear the timeout.
      
      console.log('Attempting to reconnect in 3s...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    // Store as any to reuse wsRef
    wsRef.current = eventSource as any;
  };

  useEffect(() => {
    // Calculate stats
    const buys = transactions.filter((tx) => tx.type === 'BUY');
    const sells = transactions.filter((tx) => tx.type === 'SELL');
    
    const buyVolumeSOL = buys.reduce((acc, tx) => {
      // Include if displayToken is SOL, undefined, or null
      // Also ensure solAmount is treated as a number
      const isSol = tx.displayToken === 'SOL' || !tx.displayToken;
      if (isSol) {
        return acc + (Number(tx.solAmount) || 0);
      }
      return acc;
    }, 0);

    const sellVolumeSOL = sells.reduce((acc, tx) => {
      const isSol = tx.displayToken === 'SOL' || !tx.displayToken;
      if (isSol) {
        return acc + (Number(tx.solAmount) || 0);
      }
      return acc;
    }, 0);

    setStats({ 
      total: transactions.length, 
      buys: buys.length, 
      sells: sells.length,
      buyVolumeSOL,
      sellVolumeSOL,
      totalVolumeSOL: buyVolumeSOL + sellVolumeSOL
    });
  }, [transactions]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-terminal-panel via-terminal-bg to-terminal-bg">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-terminal-border/50 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">

              <Image
                src="/pump-monitor-logo-opt.png"
                alt="PumpMonitor Logo"
                width={817}
                height={418}
                className="h-8 w-auto"
              />

              <h1 className="text-3xl font-bold tracking-tight text-white">
                Token<span className="text-terminal-success">Monitor</span>
              </h1>
            </div>
            <p className="text-terminal-muted text-sm md:text-base max-w-md">
              Real-time Solana transaction tracker for Pump.fun and Raydium
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-terminal-panel border border-terminal-border text-xs font-medium text-terminal-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-terminal-success"></span>
            </span>
            System Online
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="terminal-panel p-5 space-y-6 sticky top-6">
              <div className="flex items-center gap-2 text-terminal-text font-semibold border-b border-terminal-border/50 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-terminal-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Configuration
              </div>

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
                <div className="flex items-start gap-2 text-terminal-danger text-sm bg-terminal-danger/5 border border-terminal-danger/20 rounded-md p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="pt-2">
                {!isMonitoring ? (
                  <button
                    onClick={startMonitoring}
                    disabled={isLoading || !config.tokenAddress}
                    className="w-full terminal-button-primary flex items-center justify-center gap-2 py-3 shadow-lg shadow-terminal-success/20 hover:shadow-terminal-success/30 hover:-translate-y-0.5 transition-all"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Initializing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Monitoring
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={stopMonitoring}
                    className="w-full terminal-button-danger flex items-center justify-center gap-2 py-3 shadow-lg shadow-terminal-danger/20 hover:shadow-terminal-danger/30 hover:-translate-y-0.5 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop Monitoring
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 pb-24">
            <TransactionFeed
              transactions={transactions}
              onLoadMore={loadMore}
              isLoadingMore={isLoadingMore}
            />
          </div>
        </div>

        {/* Fixed Status Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-terminal-bg border-t border-terminal-border shadow-lg shadow-black/50">
          <div className="max-w-6xl mx-auto">
            <StatusBar
              isMonitoring={isMonitoring}
              tokenAddress={config.tokenAddress}
              stats={stats}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
