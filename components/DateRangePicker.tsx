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
      <label className="block text-sm font-medium text-terminal-text">
        Transaction Display Period
      </label>
      
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={mode === 'live'}
            onChange={() => onModeChange('live')}
            disabled={disabled}
            className="w-4 h-4 accent-terminal-success"
          />
          <span className="text-sm">Live (from now)</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={mode === 'all'}
            onChange={() => onModeChange('all')}
            disabled={disabled}
            className="w-4 h-4 accent-terminal-success"
          />
          <span className="text-sm">All time</span>
        </label>
      </div>
    </div>
  );
}
