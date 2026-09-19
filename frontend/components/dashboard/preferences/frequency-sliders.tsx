"use client"

interface FrequencySlidersProps {
  maxPerHour: number
  maxPerDay: number
  onChange: (patch: { maxPerHour?: number; maxPerDay?: number }) => void
  disabled?: boolean
}

export function FrequencySliders({
  maxPerHour,
  maxPerDay,
  onChange,
  disabled,
}: FrequencySlidersProps) {
  return (
    <div className="space-y-5">
      <Slider
        label="max per hour"
        min={1}
        max={30}
        value={maxPerHour}
        unit="ads/hr"
        disabled={disabled}
        onChange={(v) => onChange({ maxPerHour: v })}
      />
      <Slider
        label="max per day"
        min={1}
        max={300}
        value={maxPerDay}
        unit="ads/day"
        disabled={disabled}
        onChange={(v) => onChange({ maxPerDay: v })}
      />
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  value,
  unit,
  disabled,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  unit: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
          {label}
        </label>
        <span className="font-data text-[14px] font-bold tabular-nums text-[var(--ink-primary)]">
          {value} <span className="font-body text-[10px] text-[var(--ink-tertiary)]">{unit}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-pill bg-[var(--bg-inset)]">
        <div
          className="absolute left-0 top-0 h-full rounded-pill bg-[var(--accent-color)]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </div>
  )
}
