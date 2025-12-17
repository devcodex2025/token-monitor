'use client';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TokenInput({ value, onChange, disabled }: TokenInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-terminal-text">
        Token Address (Pump.fun mint address)
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter token address..."
        className="terminal-input w-full"
      />
      <p className="text-xs text-terminal-muted">
        Solana public key (base58, 32-44 characters)
      </p>
    </div>
  );
}
