'use client';

import { shortenAddress } from '@/lib/utils';
import { RateLimitInfo } from '@/types';

interface StatusBarProps {
  isMonitoring: boolean;
  tokenAddress: string;
  stats: {
    total: number;
    buys: number;
    sells: number;
    buyVolumeSOL: number;
    sellVolumeSOL: number;
    totalVolumeSOL: number;
  };
  rateLimit?: RateLimitInfo | null;
}

const formatResetIn = (rateLimit?: RateLimitInfo | null) => {
  if (!rateLimit) return '';
  const resetMs = rateLimit.resetMs ?? (rateLimit.reset ? rateLimit.reset * 1000 : undefined);
  if (!resetMs) return '';
  const seconds = Math.max(0, Math.round((resetMs - Date.now()) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
};

export default function StatusBar({ isMonitoring, tokenAddress, stats, rateLimit }: StatusBarProps) {
  const resetIn = formatResetIn(rateLimit);
  const remaining = rateLimit?.remaining;
  const limit = rateLimit?.limit;
  const showLimit = remaining !== undefined || limit !== undefined;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isMonitoring
                  ? 'bg-terminal-success animate-pulse-slow'
                  : 'bg-terminal-muted'
              }`}
            />
            <span className="text-sm font-medium">
              {isMonitoring ? 'Monitoring Active' : 'Inactive'}
            </span>
          </div>

          {tokenAddress && (
            <div className="text-sm text-terminal-muted">
              Token: <span className="font-mono">{shortenAddress(tokenAddress, 6)}</span>
            </div>
          )}
        </div>

        {showLimit && (
          <div className="text-sm text-terminal-muted">
            Helius Limit:{' '}
            <span className={remaining === 0 ? 'text-terminal-danger font-semibold' : 'text-terminal-text'}>
              {remaining ?? '?'} / {limit ?? '?'}
            </span>
            {resetIn && (
              <span className="text-terminal-muted"> · reset in {resetIn}</span>
            )}
          </div>
        )}

        {/* Stats */}
        {stats.total > 0 && (
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div>
              <span className="text-terminal-muted">Total:</span>{' '}
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div>
              <span className="text-terminal-success">Buys:</span>{' '}
              <span className="font-semibold">{stats.buys}</span>
            </div>
            <div>
              <span className="text-terminal-danger">Sells:</span>{' '}
              <span className="font-semibold">{stats.sells}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-terminal-border"></div>
            <div>
              <span className="text-terminal-muted">Buy Vol:</span>{' '}
              <span className="font-semibold text-terminal-success">{stats.buyVolumeSOL.toFixed(2)} SOL</span>
            </div>
            <div>
              <span className="text-terminal-muted">Sell Vol:</span>{' '}
              <span className="font-semibold text-terminal-danger">{stats.sellVolumeSOL.toFixed(2)} SOL</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-terminal-border"></div>
            <div>
              <span className="text-terminal-muted">Total Vol:</span>{' '}
              <span className="font-semibold text-terminal-text">{stats.totalVolumeSOL.toFixed(2)} SOL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
