'use client';

import { useState, useEffect, useRef } from 'react';
import { validateSolanaAddress } from '@/lib/utils';
import TokenInput from '@/components/TokenInput';
import DateRangePicker from '@/components/DateRangePicker';
import TransactionFeed from '@/components/TransactionFeed';
import StatusBar from '@/components/StatusBar';
import { RateLimitInfo, Transaction, TokenMonitorConfig } from '@/types';
import { 
  TRANSACTION_TYPES, 
  UNIQUE_DEX_LIST, 
  DEX_INFO,
  TransactionType 
} from '@/lib/constants';
import Image from 'next/image';

interface TokenInfo {
  name: string;
  symbol: string;
  image: string;
  decimals: number;
}

export default function Home() {
  const [config, setConfig] = useState<TokenMonitorConfig>({
    tokenAddress: '',
    mode: 'live',
    heliusApiKey: '',
  });
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [hasStoredHeliusKey, setHasStoredHeliusKey] = useState(false);

  // Filter State
  const [selectedTypes, setSelectedTypes] = useState<Set<TransactionType>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('transactionTypeFilters');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {}
      }
    }
    return new Set(TRANSACTION_TYPES.map(t => t.value));
  });

  // Ensure new Transaction Types are added to filters when code updates
  useEffect(() => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      let changed = false;
      TRANSACTION_TYPES.forEach(t => {
        if (!newSet.has(t.value)) {
          newSet.add(t.value);
          changed = true;
        }
      });
      return changed ? newSet : prev;
    });
  }, []);

  const [selectedDexNames, setSelectedDexNames] = useState<Set<string>>(new Set(UNIQUE_DEX_LIST.map(d => d.name)));

  // Ensure new DEXes are added to filters when code updates
  useEffect(() => {
    setSelectedDexNames(prev => {
      const newSet = new Set(prev);
      let changed = false;
      UNIQUE_DEX_LIST.forEach(d => {
        if (!newSet.has(d.name)) {
          newSet.add(d.name);
          changed = true;
        }
      });
      return changed ? newSet : prev;
    });
  }, []);

  // Save filters effect
  useEffect(() => {
    localStorage.setItem('transactionTypeFilters', JSON.stringify(Array.from(selectedTypes)));
  }, [selectedTypes]);

  // Filter Handlers
  const handleToggleType = (type: TransactionType) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) newSet.delete(type);
      else newSet.add(type);
      return newSet;
    });
  };

  const handleToggleDex = (name: string) => {
    setSelectedDexNames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) newSet.delete(name);
      else newSet.add(name);
      return newSet;
    });
  };

  const [lastScannedSignature, setLastScannedSignature] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ 
    total: 0, 
    buys: 0, 
    sells: 0,
    buyVolumeSOL: 0,
    sellVolumeSOL: 0,
    totalVolumeSOL: 0
  });

  const wsRef = useRef<EventSource | WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved token address from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('lastTokenAddress');
    if (savedAddress) {
      setConfig((prev) => ({ ...prev, tokenAddress: savedAddress }));
    }
    localStorage.removeItem('heliusApiKey');
  }, []);

  useEffect(() => {
    const checkStoredKey = async () => {
      try {
        const response = await fetch('/api/helius-key', { method: 'GET' });
        if (!response.ok) return;
        const data = await response.json();
        setHasStoredHeliusKey(Boolean(data?.hasKey));
      } catch (e) {
        // Ignore failures; we'll assume no stored key
      }
    };
    checkStoredKey();
  }, []);

  const persistHeliusApiKey = async () => {
    const trimmed = (config.heliusApiKey || '').trim();
    if (!trimmed) {
      // Do not delete unless user explicitly clears
      return;
    }
    const response = await fetch('/api/helius-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: trimmed }),
    });
    if (!response.ok) {
      throw new Error('Failed to store Helius API key');
    }
    setHasStoredHeliusKey(true);
  };

  const toggleShowApiKey = async () => {
    if (!showApiKey && !config.heliusApiKey && hasStoredHeliusKey) {
      try {
        const response = await fetch('/api/helius-key?reveal=1', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data?.apiKey) {
            setConfig((prev) => ({ ...prev, heliusApiKey: data.apiKey }));
          }
        }
      } catch (e) {
        // Ignore, fall back to toggling visibility only
      }
    }
    setShowApiKey((prev) => !prev);
  };

  const clearHeliusApiKey = async () => {
    await fetch('/api/helius-key', { method: 'DELETE' });
    setHasStoredHeliusKey(false);
    setConfig((prev) => ({ ...prev, heliusApiKey: '' }));
  };

  const startMonitoring = async () => {
    const trimmedApiKey = (config.heliusApiKey || '').trim();
    if (!config.tokenAddress || (!trimmedApiKey && !hasStoredHeliusKey)) {
      const missingToken = !config.tokenAddress;
      const missingKey = !trimmedApiKey && !hasStoredHeliusKey;
      const message = [
        missingToken ? 'Token address is required' : null,
        missingKey ? 'Helius API key is required' : null,
      ]
        .filter(Boolean)
        .join(' and ');
      setError(message);
      return;
    }

    if (!validateSolanaAddress(config.tokenAddress)) {
      setError('Invalid token address');
      return;
    }

    // Save token address to localStorage
    localStorage.setItem('lastTokenAddress', config.tokenAddress);

    setIsLoading(true);
    setConnectionStatus('connecting');
    setHasMore(true);
    setScannedCount(0);
    setError(null);
    setTransactions([]);
    setLastScannedSignature(null);
    
    // Only clear token info if it's a new token to avoid UI jumping
    // We can check if the current input matches the last saved one, but since we just saved it,
    // we can rely on the fact that if we are restarting, we probably want to keep the info visible.
    // If it's a new token, the user likely typed it in, so the jump is acceptable or we can keep the old one until new one loads.
    // For now, let's remove the explicit clear to prevent jumping on restart.
    // setTokenInfo(null); 

    try {
      await persistHeliusApiKey();

      // Fetch token info
      try {
        const infoResponse = await fetch(`/api/token-info?address=${config.tokenAddress}`);
        if (infoResponse.ok) {
          const info = await infoResponse.json();
          if (info?.rateLimit) setRateLimit(info.rateLimit);
          setTokenInfo(info);
        } else {
          const info = await infoResponse.json().catch(() => null);
          if (info?.rateLimit) setRateLimit(info.rateLimit);
        }
      } catch (e) {
        console.error('Failed to fetch token info', e);
      }

      // Fetch historical transactions if "all" mode
      if (config.mode === 'all') {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: config.tokenAddress,
          }),
        });

        const data = await response.json();
        if (data?.rateLimit) setRateLimit(data.rateLimit);
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch transactions');
        }
        const txs = data.transactions || [];
        setTransactions(txs);
        
        if (data.lastSignature) {
          setLastScannedSignature(data.lastSignature);
        }

        if (typeof data.rawCount === 'number') {
          setScannedCount(data.rawCount);
        }

        // Use server-provided hasMore flag if available, otherwise fallback to length check
        if (typeof data.hasMore === 'boolean') {
          setHasMore(data.hasMore);
        } else if (txs.length < 100) {
          setHasMore(false);
        }
        setIsMonitoring(true);
      } else {
        // Connect to WebSocket only in live mode
        connectWebSocket();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if ((transactions.length === 0 && !lastScannedSignature) || isLoadingMore) return;

    setIsLoadingMore(true);
    
    // Initialize cursor from state or last transaction
    let currentCursor = lastScannedSignature || (transactions.length > 0 ? transactions[transactions.length - 1].signature : null);
    
    if (!currentCursor) {
      console.warn('No cursor available for pagination');
      setIsLoadingMore(false);
      return;
    }

    const TARGET_BATCH_SIZE = 100;
    // Cap attempts to prevent infinite loading if backend keeps returning empty/few
    const MAX_BATCH_ATTEMPTS = 10; // Increased to 10 to allow searching deeper for filtered items
    let accumulatedTxs: Transaction[] = [];
    let attempts = 0;
    let serverHasMore = true;
    let finalCursor = currentCursor;

    // Helper to check if a tx matches current filters
    const matchesFilters = (tx: Transaction) => {
      // Type Check
      if (!selectedTypes.has(tx.type)) return false;
      
      // DEX Check
      let dexName = tx.dex || '';
      if (tx.dex && DEX_INFO[tx.dex]) {
         dexName = DEX_INFO[tx.dex].name;
      } else {
         const knownInfo = Object.values(DEX_INFO).find(info => info.name === tx.dex);
         if (knownInfo) dexName = knownInfo.name;
      }
      const isKnownFilter = UNIQUE_DEX_LIST.some(d => d.name === dexName);
      return isKnownFilter ? selectedDexNames.has(dexName) : true;
    };

    try {
      // Loop until we have enough transactions that MATCH OUR FILTERS or we hit a limit
      while (
        accumulatedTxs.filter(matchesFilters).length < TARGET_BATCH_SIZE && 
        attempts < MAX_BATCH_ATTEMPTS && 
        serverHasMore
      ) {
        attempts++;
        const currentMatches = accumulatedTxs.filter(matchesFilters).length;
        console.log(`Loading batch attempt ${attempts}, cursor: ${currentCursor}, matched: ${currentMatches}/${TARGET_BATCH_SIZE}`);
        
        const apiResponse: any = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: config.tokenAddress,
            before: currentCursor,
          }),
        });
  
        const data = await apiResponse.json();
        if (data?.rateLimit) setRateLimit(data.rateLimit);
        if (!apiResponse.ok) throw new Error(data?.error || 'Failed to fetch more transactions');
        const newTransactions = data.transactions || [];
        
        if (typeof data.rawCount === 'number') {
          setScannedCount(prev => prev + data.rawCount);
        }
        
        let nextCursor = data.lastSignature;
        if (!nextCursor && newTransactions.length > 0) {
          nextCursor = newTransactions[newTransactions.length - 1].signature;
        }
        
        // If we got nothing and no cursor update, we're stuck
        if (newTransactions.length === 0 && (!nextCursor || nextCursor === currentCursor)) {
          serverHasMore = false;
          break;
        }
        
        currentCursor = nextCursor;
        finalCursor = nextCursor; 
        
        accumulatedTxs = [...accumulatedTxs, ...newTransactions];
        
        if (typeof data.hasMore === 'boolean') {
          serverHasMore = data.hasMore;
        } else if (newTransactions.length === 0) {
          serverHasMore = false;
        }
      }

      // PRECISE TRIMMING LOGIC
      // Ensure we add EXACTLY 100 visible transactions if we found enough
      let visibleCount = 0;
      let cutIndex = -1;
      
      // Find the index of the 100th matching transaction
      for (let i = 0; i < accumulatedTxs.length; i++) {
        if (matchesFilters(accumulatedTxs[i])) {
          visibleCount++;
          if (visibleCount === TARGET_BATCH_SIZE) {
            cutIndex = i;
            break;
          }
        }
      }

      let txsToAdd = accumulatedTxs;
      
      // If we found more than required, trim excess and update cursor
      if (cutIndex !== -1 && cutIndex < accumulatedTxs.length - 1) {
        console.log(`Trimming accumulated transactions to exactly ${TARGET_BATCH_SIZE} matches.`);
        txsToAdd = accumulatedTxs.slice(0, cutIndex + 1);
        // Important: Update cursor to the last preserved transaction so next load starts correctly
        finalCursor = txsToAdd[txsToAdd.length - 1].signature;
        // Since we trimmed, there is definitely more content potentially
        serverHasMore = true; 
      }

      // Update state with result
      if (finalCursor) {
        setLastScannedSignature(finalCursor);
      }
      
      setHasMore(serverHasMore);

      if (txsToAdd.length > 0) {
        setTransactions((prev) => {
          const prevSignatures = new Set(prev.map(tx => tx.signature));
          const uniqueNew = txsToAdd.filter((tx: Transaction) => !prevSignatures.has(tx.signature));
          
          if (uniqueNew.length === 0) {
            console.log('No new unique transactions found');
            return prev;
          }
          
          return [...prev, ...uniqueNew];
        });
        const matchedCount = txsToAdd.filter(matchesFilters).length;
        console.log(`Loaded ${txsToAdd.length} raw txs to find ${matchedCount} matching filters in ${attempts} attempts`);
      }
    } catch (err) {
      console.error('Error loading more:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more transactions');
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
    setConnectionStatus('disconnected');
  };

  const connectWebSocket = () => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Use Server-Sent Events for Vercel compatibility
    const eventSource = new EventSource(`/api/stream?token=${encodeURIComponent(config.tokenAddress)}`);

    eventSource.onopen = () => {
      console.log('SSE connected');
      setError(null); // Clear error on successful connection
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'transaction') {
        const newTx = data.transaction as Transaction;
        
        // Log transaction with source
        const source = data._source || 'unknown';
        const emoji = source === 'webhook' ? '🎯' : source === 'websocket' ? '⚡' : '📊';
        
        if (data._timing) {
          console.log(`${emoji} ${source.toUpperCase()}: Receive ${data._timing.receive}ms | Parse ${data._timing.parse}ms | Total ${data._timing.total}ms`);
        } else {
          console.log(`${emoji} Transaction received via ${source}`);
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
      } else if (data.type === 'connected') {
        console.log(`✅ ${data.message} - ${data.tokenAddress}`);
        setIsMonitoring(true);
      } else if (data.type === 'connecting') {
        console.log(`🔌 ${data.message}`);
      } else if (data.type === 'heartbeat') {
        // Heartbeat to keep connection alive (silent)
      } else if (data.type === 'error') {
        console.error('❌ Stream error:', data.message);
        setError(data.message || 'Live stream error');
        setConnectionStatus('disconnected');
        // Stop monitoring on explicit server error (bad key, rate limit, etc.)
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        setIsMonitoring(false);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnectionStatus('reconnecting');
      setError('Live stream disconnected. Reconnecting...');
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
    // Calculate stats - exclude liquidity and fee management transactions
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
              Real-time Solana transaction tracker for Pump.fun and Solana tokens on other Dexes.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-terminal-panel border border-terminal-border text-xs font-medium text-terminal-muted transition-colors duration-300">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 transition-all duration-500 ${
                  (connectionStatus === 'connected' || (isMonitoring && config.mode === 'all'))
                    ? 'animate-ping bg-terminal-success'
                    : (config.tokenAddress && (config.heliusApiKey?.trim() || hasStoredHeliusKey))
                      ? 'bg-terminal-warning'
                      : 'bg-terminal-danger'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-500 ${
                  (connectionStatus === 'connected' || (isMonitoring && config.mode === 'all'))
                    ? 'bg-terminal-success'
                    : (config.tokenAddress && (config.heliusApiKey?.trim() || hasStoredHeliusKey))
                      ? 'bg-terminal-warning'
                      : 'bg-terminal-danger'
                }`}
              ></span>
            </span>
            <span className="transition-opacity duration-300">
              {connectionStatus === 'connected' 
                ? 'System Online' 
                : (isMonitoring && config.mode === 'all') 
                  ? 'System Online (historic mode)' 
                  : (config.tokenAddress && (config.heliusApiKey?.trim() || hasStoredHeliusKey))
                    ? 'System ready to start'
                    : 'System Offline'}
            </span>
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

              {tokenInfo && (
                <div className="flex items-center gap-4 p-4 bg-terminal-bg/50 rounded-lg border border-terminal-border/50">
                  {tokenInfo.image ? (
                    <div className="relative h-12 w-12 rounded-full overflow-hidden border border-terminal-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={tokenInfo.image} 
                        alt={tokenInfo.symbol}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-terminal-panel border border-terminal-border flex items-center justify-center text-xl">
                      🪙
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-lg">{tokenInfo.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-terminal-success font-mono font-bold">{tokenInfo.symbol}</span>
                      <span className="text-xs text-terminal-muted px-1.5 py-0.5 rounded bg-terminal-bg border border-terminal-border">
                        {tokenInfo.decimals} dec
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <TokenInput
                value={config.tokenAddress}
                onChange={(address) =>
                  setConfig((prev) => ({ ...prev, tokenAddress: address }))
                }
                disabled={isMonitoring}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-terminal-text/80 uppercase tracking-wider text-xs">
                  Helius API Key (optional)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.heliusApiKey || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, heliusApiKey: e.target.value }))
                    }
                    disabled={isMonitoring}
                    placeholder={hasStoredHeliusKey ? 'Key stored securely, click to change' : 'Paste your Helius key to override server env...'}
                    className="terminal-input w-full py-3 bg-terminal-bg/50 focus:bg-terminal-bg transition-all border-terminal-border focus:border-terminal-success/50 focus:ring-1 focus:ring-terminal-success/50"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-terminal-muted flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-terminal-muted" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                      <path d="M400 192h-24v-72C376 53.7 322.3 0 256 0S136 53.7 136 120v72H112c-26.5 0-48 21.5-48 48v224c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V240c0-26.5-21.5-48-48-48zM184 120c0-39.7 32.3-72 72-72s72 32.3 72 72v72H184v-72z" />
                    </svg>
                    Stored securely in an HTTP-only cookie for 90 days.
                  </p>
                  <button
                    type="button"
                    onClick={toggleShowApiKey}
                    disabled={isMonitoring}
                    className="terminal-button-secondary px-3 py-2 text-xs whitespace-nowrap flex items-center gap-2"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.477 10.48a2 2 0 102.828 2.828M9.88 4.24A9.97 9.97 0 0112 4c5 0 9 5 9 8a8.96 8.96 0 01-1.564 4.676M6.228 6.228A8.964 8.964 0 003 12c0 3 4 8 9 8 1.424 0 2.78-.31 4.013-.86" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={clearHeliusApiKey}
                    disabled={isMonitoring || !hasStoredHeliusKey}
                    className="terminal-button-secondary px-3 py-2 text-xs whitespace-nowrap flex items-center gap-2"
                    title="Clear stored API key"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7-3h8a1 1 0 011 1v2H7V5a1 1 0 011-1z" />
                    </svg>
                  </button>
                </div>
              </div>

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
              status={connectionStatus}
              hasMore={hasMore}
              scannedCount={scannedCount}
              selectedTypes={selectedTypes}
              selectedDexNames={selectedDexNames}
              onToggleType={handleToggleType}
              onToggleDex={handleToggleDex}
              onSetAllTypes={setSelectedTypes}
              onSetAllDexes={setSelectedDexNames}
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
              rateLimit={rateLimit}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
