interface MemorySelectorProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const MEMORY_PRESETS = [128, 256, 512, 1024, 2048];

export function MemorySelector({
  label,
  value,
  onChange,
  min = 64,
  max = 2048,
  disabled,
}: MemorySelectorProps) {
  return (
    <div>
      <label>{label}</label>
      <div className="flex gap-2 flex-wrap">
        {MEMORY_PRESETS.filter((m) => m >= min && m <= max).map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            disabled={disabled}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              value === preset
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {preset >= 1024 ? `${preset / 1024} GB` : `${preset} MB`}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <input
          type="range"
          min={min}
          max={max}
          step={64}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="w-full"
        />
        <div className="text-sm text-gray-400 text-center">
          {value} MiB
        </div>
      </div>
    </div>
  );
}
