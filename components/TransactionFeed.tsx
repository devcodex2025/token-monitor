'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Transaction } from '@/types';
import { shortenAddress, formatSolAmount, formatTime, formatDateTime, timeAgo } from '@/lib/utils';
import { 
  TRANSACTION_TYPES, 
  DEX_INFO, 
  UNIQUE_DEX_LIST, 
  TransactionType 
} from '@/lib/constants';

interface TransactionFeedProps {
  transactions: Transaction[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  status?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  hasMore?: boolean;
  scannedCount?: number;
  
  // Filter Props
  selectedTypes: Set<TransactionType>;
  selectedDexNames: Set<string>;
  onToggleType: (type: TransactionType) => void;
  onToggleDex: (name: string) => void;
  onSetAllTypes: (types: Set<TransactionType>) => void;
  onSetAllDexes: (names: Set<string>) => void;
}

export default function TransactionFeed({ 
  transactions, 
  onLoadMore, 
  isLoadingMore, 
  status = 'disconnected', 
  hasMore = true, 
  scannedCount = 0,
  
  // New props with defaults (though usually passed by parent)
  selectedTypes,
  selectedDexNames,
  onToggleType,
  onToggleDex,
  onSetAllTypes,
  onSetAllDexes
}: TransactionFeedProps) {
  const prevTopTxSig = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstRender = useRef(true);

  // Local UI state
  const [showDexFilter, setShowDexFilter] = useState(false);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => selectedTypes.has(tx.type))
      .filter(tx => {
        // Resolve transaction DEX to a display name
        let dexName = tx.dex || '';
        
        // Check if tx.dex is a key in the config
        if (tx.dex && DEX_INFO[tx.dex]) {
           dexName = DEX_INFO[tx.dex].name;
        } else {
           // Fallback: check if tx.dex matches any known name value
           const knownInfo = Object.values(DEX_INFO).find(info => info.name === tx.dex);
           if (knownInfo) dexName = knownInfo.name;
        }
        
        // If the resolved name is one of our managed DEX filters, check if it's selected
        const isKnownFilter = UNIQUE_DEX_LIST.some(d => d.name === dexName);
        return isKnownFilter ? selectedDexNames.has(dexName) : true;
      })
      .sort((a, b) => b.blockTime - a.blockTime);
  }, [transactions, selectedTypes, selectedDexNames]);

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
    let message = 'Click "Start Monitoring" to display transactions';
    
    if (status === 'connecting') {
      message = 'Connecting...';
    } else if (status === 'connected') {
      message = 'Connection established, waiting for transactions';
    } else if (status === 'reconnecting') {
      message = 'Reconnecting, connection lost';
    }

    return (
      <div className="terminal-panel p-8 text-center">
        <div className="text-terminal-muted">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg">Waiting for transactions...</p>
          <p className="text-sm mt-2">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel overflow-hidden flex flex-col h-[600px]">
      <div className="bg-terminal-bg border-b border-terminal-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold">Transaction Feed</h2>
        <div className="text-sm text-terminal-muted flex items-center gap-3">
          {scannedCount > 0 && (
            <div className="flex items-center gap-1 group relative cursor-help">
              <span className="flex items-center gap-1">
                 <span className="text-xs">🔍</span> {scannedCount} scanned
              </span>
              <div className="absolute top-full right-0 mt-2 w-64 p-2 bg-terminal-panel border border-terminal-border rounded shadow-xl hidden group-hover:block z-50 text-xs">
                 <p className="font-semibold mb-1 border-b border-terminal-border/50 pb-1">Filtering Details</p>
                 <p className="text-terminal-muted">Scanned {scannedCount} blocks to find {transactions.length} relevant transactions.</p>
                 <p className="mt-1 text-terminal-muted italic">Non-relevant txs (spam, other pairs) are skipped automatically.</p>
              </div>
            </div>
          )}
          <span>
            {sortedTransactions.length} shown {transactions.length !== sortedTransactions.length ? `(of ${transactions.length} loaded)` : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-terminal-surface/30 border-b border-terminal-border px-4 py-2 flex items-center justify-start gap-3 flex-shrink-0 z-20 relative">
        <div className="relative">
          <button 
            onClick={() => setShowTypeFilter(!showTypeFilter)}
            className={`text-xs px-3 py-1 rounded transition-colors flex items-center gap-2 border ${
              showTypeFilter
                ? 'bg-terminal-surface border-terminal-border text-terminal-text shadow-sm'
                : selectedTypes.size !== TRANSACTION_TYPES.length 
                  ? 'bg-terminal-primary/20 text-terminal-primary border-transparent' 
                  : 'bg-terminal-bg/50 text-terminal-muted border-transparent hover:bg-terminal-surface'
            }`}
          >
            <span>🏷️</span> TX Types {selectedTypes.size !== TRANSACTION_TYPES.length ? `(${selectedTypes.size})` : ''}
          </button>

          {showTypeFilter && (
            <>
              {/* Overlay to close on click outside */}
              <div className="fixed inset-0 z-10" onClick={() => setShowTypeFilter(false)} />
              
              {/* Popup */}
              <div className="absolute left-0 top-full mt-2 w-64 bg-terminal-panel border border-terminal-border rounded-lg shadow-xl shadow-black/50 p-3 z-20">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-terminal-border">
                  <span className="text-xs font-semibold text-terminal-text">Filter by Type</span>
                  <div className="flex gap-2">
                    <button onClick={() => onSetAllTypes(new Set(TRANSACTION_TYPES.map(t => t.value)))} className="text-[10px] text-terminal-success hover:underline">Select All</button>
                    <button onClick={() => onSetAllTypes(new Set())} className="text-[10px] text-terminal-muted hover:underline">Clear</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  {TRANSACTION_TYPES.map(type => {
                    const isSelected = selectedTypes.has(type.value);
                    return (
                      <button
                        key={type.value}
                        onClick={() => onToggleType(type.value)}
                        className={`text-xs px-2 py-1.5 rounded transition-all flex items-center gap-2 w-full text-left border ${
                          isSelected
                            ? 'bg-terminal-surface border-terminal-border'
                            : 'opacity-50 hover:opacity-100 border-transparent'
                        }`}
                      >
                         <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'border-terminal-primary bg-terminal-primary/20' : 'border-terminal-muted'}`}>
                            {isSelected && <span className="text-[10px] text-terminal-primary">✓</span>}
                         </div>
                         <span className="w-5 text-center">{type.emoji}</span>
                        <span className={isSelected ? 'text-terminal-text' : 'text-terminal-muted'}>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowDexFilter(!showDexFilter)}
            className={`text-xs px-3 py-1 rounded transition-colors flex items-center gap-2 border ${
              showDexFilter
                ? 'bg-terminal-surface border-terminal-border text-terminal-text shadow-sm'
                : selectedDexNames.size !== UNIQUE_DEX_LIST.length 
                  ? 'bg-terminal-primary/20 text-terminal-primary border-transparent' 
                  : 'bg-terminal-bg/50 text-terminal-muted border-transparent hover:bg-terminal-surface'
            }`}
          >
            <span>🏢</span> DEXes {selectedDexNames.size !== UNIQUE_DEX_LIST.length ? `(${selectedDexNames.size})` : ''}
          </button>

          {showDexFilter && (
            <>
              {/* Overlay to close on click outside */}
              <div className="fixed inset-0 z-10" onClick={() => setShowDexFilter(false)} />
              
              {/* Popup */}
              <div className="absolute left-0 top-full mt-2 w-72 bg-terminal-panel border border-terminal-border rounded-lg shadow-xl shadow-black/50 p-3 z-20">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-terminal-border">
                  <span className="text-xs font-semibold text-terminal-text">Filter by DEX</span>
                  <div className="flex gap-2">
                    <button onClick={() => onSetAllDexes(new Set(UNIQUE_DEX_LIST.map(d => d.name)))} className="text-[10px] text-terminal-success hover:underline">Select All</button>
                    <button onClick={() => onSetAllDexes(new Set())} className="text-[10px] text-terminal-muted hover:underline">Clear</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
                  {UNIQUE_DEX_LIST.map(info => {
                    const isSelected = selectedDexNames.has(info.name);
                    return (
                      <button
                        key={info.name}
                        onClick={() => onToggleDex(info.name)}
                        className={`text-xs px-2 py-1.5 rounded transition-all flex items-center gap-2 w-full text-left border ${
                          isSelected
                            ? 'bg-terminal-surface border-terminal-border'
                            : 'opacity-50 hover:opacity-100 border-transparent'
                        }`}
                        style={isSelected ? { borderColor: info.color } : {}}
                      >
                         <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? '' : 'border-terminal-muted'}`} style={{ borderColor: isSelected ? info.color : undefined }}>
                            {isSelected && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }}></div>}
                         </div>
                        <img src={info.logo || '/logos/phantom.svg'} alt={info.name} className="w-4 h-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9“12”IHI9IjEwIi8+PC9zdmc+' }} />
                        <span className={isSelected ? 'text-terminal-text' : 'text-terminal-muted'}>{info.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legacy DEX Filters - Removed */}

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
        
        {onLoadMore && hasMore && (
          <div className="p-4 text-center border-t border-terminal-border/50">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 rounded bg-terminal-surface text-terminal-text border border-terminal-border hover:bg-terminal-surface/80 hover:border-terminal-text/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full group relative"
            >
              {isLoadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scanning history ({scannedCount} blocks)...
                  </span>
              ) : (
                  'Load 100 older transactions'
              )}
            </button>
            {isLoadingMore && (
                <p className="text-[10px] text-terminal-muted mt-2 animate-pulse">
                    Deep scanning in progress. Filtering spam & generic transfers...
                </p>
            )}
          </div>
        )}
        {onLoadMore && !hasMore && (
          <div className="p-4 text-center border-t border-terminal-border/50 text-terminal-muted text-sm">
            End of transaction history
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
                  {transaction.displayToken === 'Transfer' ? 'Wallet transfer' : transaction.displayToken || 'Wallet transfer'}
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
