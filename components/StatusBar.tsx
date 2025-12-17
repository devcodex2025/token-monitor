'use client';

import { shortenAddress } from '@/lib/utils';

interface StatusBarProps {
  isMonitoring: boolean;
  tokenAddress: string;
  stats: {
    total: number;
    buys: number;
    sells: number;
  };
}

export default function StatusBar({ isMonitoring, tokenAddress, stats }: StatusBarProps) {
  return (
    <div className="terminal-panel p-4 mb-6">
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

        {/* Stats */}
        {stats.total > 0 && (
          <div className="flex items-center gap-6 text-sm">
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
            <div>
              <span className="text-terminal-muted">Ratio:</span>{' '}
              <span className="font-semibold">
                {stats.total > 0
                  ? ((stats.buys / stats.total) * 100).toFixed(1)
                  : 0}
                % / {stats.total > 0
                  ? ((stats.sells / stats.total) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
