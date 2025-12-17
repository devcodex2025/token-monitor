'use client';

import { useState } from 'react';
import { Transaction } from '@/types';
import { shortenAddress, formatSolAmount, formatTime } from '@/lib/utils';

interface TransactionFeedProps {
  transactions: Transaction[];
}

export default function TransactionFeed({ transactions }: TransactionFeedProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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

  // Calculate pagination
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="terminal-panel overflow-hidden">
      <div className="bg-terminal-bg border-b border-terminal-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transaction Feed</h2>
        <div className="text-sm text-terminal-muted">
          {transactions.length} transactions
        </div>
      </div>
      
      <div className="max-h-[600px] overflow-y-auto">
        {currentTransactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-terminal-bg border-t border-terminal-border px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-terminal-muted">
            Page {currentPage} of {totalPages} ({startIndex + 1}-{Math.min(endIndex, transactions.length)} of {transactions.length})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-terminal-surface text-terminal-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-terminal-surface/80 transition-colors text-sm"
            >
              ⟪ First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-terminal-surface text-terminal-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-terminal-surface/80 transition-colors text-sm"
            >
              ← Prev
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-terminal-surface text-terminal-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-terminal-surface/80 transition-colors text-sm"
            >
              Next →
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-terminal-surface text-terminal-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-terminal-surface/80 transition-colors text-sm"
            >
              Last ⟫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isBuy = transaction.type === 'BUY';
  
  return (
    <div
      className={`transaction-row ${
        isBuy ? 'transaction-buy' : 'transaction-sell'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Time */}
        <div className="text-xs text-terminal-muted font-mono w-20">
          {formatTime(transaction.blockTime)}
        </div>

        {/* Type Badge */}
        <div
          className={`px-3 py-1 rounded text-xs font-bold ${
            isBuy
              ? 'bg-terminal-success/20 text-terminal-success'
              : 'bg-terminal-danger/20 text-terminal-danger'
          }`}
        >
          {isBuy ? '🟢 BUY' : '🔴 SELL'}
        </div>

        {/* Wallet */}
        <div className="font-mono text-sm text-terminal-text/80">
          {shortenAddress(transaction.wallet)}
        </div>

        {/* Amount */}
        <div className="ml-auto flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-medium">
              {formatSolAmount(transaction.solAmount)} {transaction.displayToken || 'SOL'}
            </div>
            <div className="text-xs text-terminal-muted">
              {transaction.tokenAmount.toLocaleString()} tokens
            </div>
          </div>

          {/* Link to explorer */}
          <a
            href={`https://solscan.io/tx/${transaction.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terminal-warning hover:text-terminal-warning/80 transition-colors"
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
    </div>
  );
}
