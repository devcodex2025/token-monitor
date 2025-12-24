'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Transaction } from '@/types';
import { shortenAddress, formatSolAmount, formatTime, formatDateTime, timeAgo } from '@/lib/utils';

// Transaction type filter options
type TransactionType = Transaction['type'];
const TRANSACTION_TYPES: { value: TransactionType; label: string; emoji: string }[] = [
  { value: 'BUY', label: 'Buy', emoji: '📈' },
  { value: 'SELL', label: 'Sell', emoji: '📉' },
  { value: 'ADD_LIQUIDITY', label: 'Add LP', emoji: '💧' },
  { value: 'REMOVE_LIQUIDITY', label: 'Remove LP', emoji: '💧' },
  { value: 'CLAIM_FEES', label: 'Claim Fees', emoji: '💰' },
  { value: 'TRANSFER', label: 'Transfer', emoji: '↔️' },
];

// DEX Configuration
const DEX_INFO: Record<string, { name: string; logo?: string; color?: string }> = {
  'JUPITER': { 
    name: 'Jupiter', 
    logo: 'https://jup.ag/svg/jupiter-logo.svg',
    color: '#16a34a' // green-600
  },
  'PUMP.FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'RAYDIUM': { 
    name: 'Raydium', 
    logo: 'https://img.raydium.io/logo/raydium_logo.png',
    color: '#2563eb' // blue-600
  },
  'ORCA': { 
    name: 'Orca', 
    logo: 'https://cryptologos.cc/logos/orca-orca-logo.png?v=035',
    color: '#f59e0b' // amber-500
  },
  'PUMPFUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP.FUN AMM': { 
    name: 'Pump.fun AMM', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP_FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'OKX_DEX_ROUTER': { 
    name: 'OKX DEX', 
    logo: '/logos/okx.webp',
    color: '#000000'
  },
  'OKX DEX': { 
    name: 'OKX DEX', 
    logo: '/logos/okx.webp',
    color: '#000000'
  },
  'METEORA DLMM': {  
    name: 'Meteora DLMM', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'METEORA': { 
    name: 'Meteora DLMM', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'METEORA_DAMM_V2': { 
    name: 'Meteora DAMM v2', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'DFlow': {
    name: 'DFlow',
    logo: '/logos/dflow.svg',
    color: '#FF4F98'
  },
  'DFLOW': {
    name: 'DFlow',
    logo: '/logos/dflow.svg',
    color: '#FF4F98'
  },
  'Onchain Labs': {
    name: 'Onchain Labs',
    logo: '/logos/okx.webp', // Using OKX logo as fallback since it's related to OKX DEX
    color: '#000000'
  },
  'PHANTOM': {
    name: 'Phantom',
    logo: '/logos/phantom.svg',
    color: '#AB9FF2'
  },
};

interface TransactionFeedProps {
  transactions: Transaction[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export default function TransactionFeed({ transactions, onLoadMore, isLoadingMore }: TransactionFeedProps) {
  const prevTopTxSig = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstRender = useRef(true);

  // Filter state - load from localStorage
  const [selectedTypes, setSelectedTypes] = useState<Set<TransactionType>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('transactionTypeFilters');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          // Fallback to all types
        }
      }
    }
    // Default: show all types
    return new Set(TRANSACTION_TYPES.map(t => t.value));
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('transactionTypeFilters', JSON.stringify(Array.from(selectedTypes)));
  }, [selectedTypes]);

  // Toggle filter
  const toggleFilter = (type: TransactionType) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => selectedTypes.has(tx.type))
      .sort((a, b) => b.blockTime - a.blockTime);
  }, [transactions, selectedTypes]);

  // Sort transactions by date (newest first)
  const sortedTransactions = filteredAndSortedTransactions;

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Play sound only on NEW transactions (at the top of the list)
  useEffect(() => {
    if (sortedTransactions.length > 0) {
      const newestTx = sortedTransactions[0];
      
      // If we have a previous top tx and it's different from the current one
      // And it's not the first render (to avoid sound on initial load)
      if (!isFirstRender.current && prevTopTxSig.current && prevTopTxSig.current !== newestTx.signature) {
        audioRef.current?.play().catch(e => console.log('Audio play failed:', e));
      }
      
      prevTopTxSig.current = newestTx.signature;
    }
    isFirstRender.current = false;
  }, [sortedTransactions]);

  // Reset when transactions array is cleared (new token monitored)
  useEffect(() => {
    if (transactions.length === 0) {
      prevTopTxSig.current = null;
      isFirstRender.current = true;
    }
  }, [transactions.length]);

  if (transactions.length === 0) {
    return (
      <div className="terminal-panel p-8 text-center">
        <div className="text-terminal-muted">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg">Waiting for transactions...</p>
          <p className="text-sm mt-2">
            Click "Start Monitoring" to display transactions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel overflow-hidden flex flex-col h-[600px]">
      <div className="bg-terminal-bg border-b border-terminal-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold">Transaction Feed</h2>
        <div className="text-sm text-terminal-muted">
          {sortedTransactions.length} / {transactions.length} transactions
        </div>
      </div>

      {/* Filters */}
      <div className="bg-terminal-surface/30 border-b border-terminal-border px-4 py-2 flex flex-wrap gap-2 flex-shrink-0">
        <span className="text-xs text-terminal-muted self-center">Show:</span>
        {TRANSACTION_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => toggleFilter(type.value)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedTypes.has(type.value)
                ? 'bg-terminal-success/20 text-terminal-success border border-terminal-success/50'
                : 'bg-terminal-bg/50 text-terminal-muted border border-terminal-border hover:border-terminal-muted/50'
            }`}
          >
            <span className="mr-1">{type.emoji}</span>
            {type.label}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-terminal-surface/50 border-b border-terminal-border text-xs font-medium text-terminal-muted uppercase tracking-wider flex-shrink-0">
        <div className="w-20">Time</div>
        <div className="w-16">Type</div>
        <div className="w-24">DEX</div>
        <div className="w-20 hidden md:block">TX ID</div>
        <div className="flex-1">Wallet</div>
        <div className="text-right w-40">Amount</div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sortedTransactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))}
        
        {onLoadMore && (
          <div className="p-4 text-center border-t border-terminal-border/50">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 rounded bg-terminal-surface text-terminal-text hover:bg-terminal-surface/80 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
              {isLoadingMore ? 'Loading history...' : 'Load older transactions'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isBuy = transaction.type === 'BUY';
  const isSell = transaction.type === 'SELL';
  const isRemoveLiquidity = transaction.type === 'REMOVE_LIQUIDITY';
  const isClaimFees = transaction.type === 'CLAIM_FEES';
  const isAddLiquidity = transaction.type === 'ADD_LIQUIDITY';
  const isTransfer = transaction.type === 'TRANSFER';
  const [timeAgoStr, setTimeAgoStr] = useState(timeAgo(transaction.blockTime));

  // Update time ago every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgoStr(timeAgo(transaction.blockTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [transaction.blockTime]);

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };
  
  return (
    <div
      className={`transaction-row animate-slide-in ${
        isBuy ? 'transaction-buy' : isSell ? 'transaction-sell' : isClaimFees ? 'transaction-claim' : isAddLiquidity ? 'transaction-add-lp' : isTransfer ? 'transaction-transfer' : 'transaction-remove'
      }`}
    >
      <div className="flex items-center gap-4 flex-1 px-4">
        {/* Time */}
        <div 
          className="text-xs text-terminal-muted font-mono w-20 flex-shrink-0 cursor-default group relative"
        >
          <span className="border-b border-dotted border-terminal-muted/50">{timeAgoStr}</span>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
            <div className="bg-terminal-panel border border-terminal-border text-terminal-text text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {formatDateTime(transaction.blockTime)}
            </div>
          </div>
        </div>

        {/* Type Badge */}
        <div className="w-16 flex-shrink-0">
          <div
            className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
              isBuy
                ? 'bg-terminal-success/20 text-terminal-success'
                : isSell
                ? 'bg-terminal-danger/20 text-terminal-danger'
                : isClaimFees
                ? 'bg-yellow-500/20 text-yellow-400'
                : isAddLiquidity
                ? 'bg-green-500/20 text-green-400'
                : isTransfer
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-purple-500/20 text-purple-400'
            }`}
          >
            {isClaimFees ? (
              <span className="flex items-center gap-1">
                <span>💰</span>
                <span>FEES</span>
              </span>
            ) : isAddLiquidity ? (
              <span className="flex items-center gap-1">
                <span>💧</span>
                <span>+LP</span>
              </span>
            ) : isRemoveLiquidity ? (
              <span className="flex items-center gap-1">
                <span>💧</span>
                <span>-LP</span>
              </span>
            ) : isTransfer ? (
              <span className="flex items-center gap-1">
                <span>↔️</span>
                <span>XFER</span>
              </span>
            ) : (
              isBuy ? 'BUY' : 'SELL'
            )}
          </div>
        </div>

        {/* DEX Badge */}
        <div className="w-24 flex-shrink-0 overflow-hidden">
          {transaction.dex ? <DexBadge dex={transaction.dex} /> : <span className="text-xs text-terminal-muted">-</span>}
        </div>

        {/* Transaction ID */}
        <div 
          className="font-mono text-xs text-terminal-muted hidden md:block w-20 flex-shrink-0 cursor-pointer hover:text-terminal-text transition-colors select-none" 
          title="Double click to copy Transaction ID"
          onDoubleClick={() => handleCopy(transaction.signature)}
        >
          {shortenAddress(transaction.signature, 4)}
        </div>

        {/* Wallet */}
        <div 
          className="font-mono text-sm text-terminal-text/80 flex-1 min-w-0 truncate cursor-pointer hover:text-terminal-text transition-colors select-none"
          title="Double click to copy Wallet Address"
          onDoubleClick={() => handleCopy(transaction.wallet)}
        >
          {shortenAddress(transaction.wallet)}
        </div>

        {/* Amount */}
        <div className="w-40 flex-shrink-0 text-right">
          <div className="text-sm font-medium">
            {transaction.displayToken === 'Fees' ? (
              <span className="text-terminal-warning flex items-center justify-end gap-1">
                <span>🎁</span>
                <span>(Claim Fees)</span>
              </span>
            ) : isRemoveLiquidity || isClaimFees ? (
              // Remove Liquidity: liquidity exits pool (negative for token monitoring)
              // Claim Fees: rewards received (positive)
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-terminal-muted text-xs">{isClaimFees ? '+' : '-'}</span>
                  <span>{formatSolAmount(transaction.solAmount)} SOL</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-terminal-muted text-xs">{isClaimFees ? '+' : '-'}</span>
                  <span className="text-xs">{transaction.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} tokens</span>
                </div>
                {/* Show combined Claim Fees if present */}
                {transaction.claimFeesAmount && transaction.claimFeesAmount > 0 && (
                  <div className="flex items-center gap-1 text-yellow-400 mt-1">
                    <span className="text-xs">💰</span>
                    <span className="text-terminal-muted text-xs">+</span>
                    <span className="text-xs">{formatSolAmount(transaction.claimFeesAmount)} SOL fees</span>
                  </div>
                )}
              </div>
            ) : isAddLiquidity ? (
              // Add Liquidity: liquidity added to pool (positive for token monitoring)
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-terminal-muted text-xs">+</span>
                  <span>{formatSolAmount(transaction.solAmount)} SOL</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-terminal-muted text-xs">+</span>
                  <span className="text-xs">{transaction.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} tokens</span>
                </div>
              </div>
            ) : isTransfer ? (
              // Simple Transfer: show only token amount
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-terminal-muted text-xs">↔️</span>
                  <span className="text-xs">{transaction.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} tokens</span>
                </div>
                <div className="text-xs text-terminal-muted/70">
                  Wallet transfer
                </div>
              </div>
            ) : (
              <>
                {formatSolAmount(transaction.solAmount)} {transaction.displayToken || 'SOL'}
              </>
            )}
          </div>
          {!isRemoveLiquidity && !isClaimFees && !isAddLiquidity && !isTransfer && (
            <div className="text-xs text-terminal-muted">
              {transaction.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} tokens
            </div>
          )}
        </div>

        {/* Link to explorer */}
        <a
          href={`https://solscan.io/tx/${transaction.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-terminal-warning hover:text-terminal-warning/80 transition-colors ml-2 flex-shrink-0"
          title="View on Solscan"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

function DexBadge({ dex }: { dex: string }) {
  const [imageError, setImageError] = useState(false);
  
  // Normalize key for lookup (uppercase)
  const lookupKey = dex.toUpperCase();
  const info = DEX_INFO[lookupKey];
  
  // Fallback name if not in config
  const displayName = info?.name || dex.replace(/_/g, ' ');
  
  // Determine if we should show logo
  const showLogo = info?.logo && !imageError;

  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-terminal-surface border border-terminal-border whitespace-nowrap transition-all hover:bg-terminal-surface/80"
      title={displayName}
    >
      {showLogo ? (
        <img 
          src={info.logo} 
          alt={displayName}
          className="w-4 h-4 object-contain"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-lg leading-none">
          {/* Simple icon fallback based on first letter if no logo */}
          ⚡
        </span>
      )}
      <span className="text-terminal-muted">{displayName}</span>
    </div>
  );
}
