'use client';

interface DateRangePickerProps {
  mode: 'live' | 'all';
  onModeChange: (mode: 'live' | 'all') => void;
  disabled?: boolean;
}

export default function DateRangePicker({
  mode,
  onModeChange,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-terminal-text/80 uppercase tracking-wider text-xs">
        Monitoring Mode
      </label>
      
      <div className="grid grid-cols-2 gap-2 p-1 bg-terminal-bg/50 rounded-lg border border-terminal-border">
        <button
          onClick={() => !disabled && onModeChange('live')}
          disabled={disabled}
          className={`
            relative flex items-center justify-center gap-2 py-3 rounded-md transition-all duration-200 font-medium text-sm
            ${mode === 'live' 
              ? 'bg-terminal-success/10 text-terminal-success border border-terminal-success/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
              : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-panel border border-transparent'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="relative flex h-2.5 w-2.5">
            {mode === 'live' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-success opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${mode === 'live' ? 'bg-terminal-success' : 'bg-terminal-muted'}`}></span>
          </span>
          Live Feed
        </button>
        
        <button
          onClick={() => !disabled && onModeChange('all')}
          disabled={disabled}
          className={`
            flex items-center justify-center gap-2 py-3 rounded-md transition-all duration-200 font-medium text-sm
            ${mode === 'all' 
              ? 'bg-terminal-warning/10 text-terminal-warning border border-terminal-warning/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-panel border border-transparent'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Historical Data
        </button>
      </div>
    </div>
  );
}
