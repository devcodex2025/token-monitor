'use client';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TokenInput({ value, onChange, disabled }: TokenInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-terminal-text/80 uppercase tracking-wider text-xs">
        Token Address
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-terminal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter Pump.fun mint address..."
          className="terminal-input w-full pl-10 py-3 bg-terminal-bg/50 focus:bg-terminal-bg transition-all border-terminal-border focus:border-terminal-success/50 focus:ring-1 focus:ring-terminal-success/50"
        />
      </div>
      <p className="text-xs text-terminal-muted flex items-center gap-1">
        <span className="inline-block w-1 h-1 rounded-full bg-terminal-muted"></span>
        Solana public key (base58)
      </p>
    </div>
  );
}
