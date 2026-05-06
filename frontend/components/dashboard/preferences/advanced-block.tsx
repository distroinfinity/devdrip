"use client"

import { cn } from "@distrotv/design-system/utils"

interface AdvancedBlockProps {
  idleSensitivityMs: number
  sessionWarmupMs: number
  nightMode: boolean
  onChange: (patch: {
    idleSensitivityMs?: number
    sessionWarmupMs?: number
    nightMode?: boolean
  }) => void
  disabled?: boolean
}

export function AdvancedBlock({
  idleSensitivityMs,
  sessionWarmupMs,
  nightMode,
  onChange,
  disabled,
}: AdvancedBlockProps) {
  return (
    <div className="space-y-4">
      <NumberRow
        label="idle threshold"
        unit="ms"
        value={idleSensitivityMs}
        min={1_000}
        max={300_000}
        step={500}
        disabled={disabled}
        hint="how long Claude must be idle before we count it as ad-eligible"
        onChange={(v) => onChange({ idleSensitivityMs: v })}
      />
      <NumberRow
        label="session warmup"
        unit="ms"
        value={sessionWarmupMs}
        min={0}
        max={60_000}
        step={500}
        disabled={disabled}
        hint="grace period at the start of a session before the first ad can show"
        onChange={(v) => onChange({ sessionWarmupMs: v })}
      />

      <button
        type="button"
        onClick={() => onChange({ nightMode: !nightMode })}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors",
          nightMode
            ? "border-[var(--accent-color)] bg-[var(--accent-glow)]"
            : "border-[var(--rule-default)] bg-[var(--bg-inset)] hover:border-[var(--rule-strong)]"
        )}
      >
        <span>
          <span
            className={cn(
              "block font-body text-[13px]",
              nightMode ? "text-[var(--accent-color)]" : "text-[var(--ink-primary)]"
            )}
          >
            Night mode
          </span>
          <span className="block font-body text-[11px] text-[var(--ink-tertiary)]">
            no ads from 22:00 → 07:00 unless you set custom quiet hours above
          </span>
        </span>
        <span
          className={cn(
            "rounded-pill border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em]",
            nightMode
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-[var(--rule-default)] text-[var(--ink-tertiary)]"
          )}
        >
          {nightMode ? "on" : "off"}
        </span>
      </button>
    </div>
  )
}

function NumberRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  hint,
  disabled,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  hint?: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
          {label}
        </label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
          }}
          className="w-32 rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-3 py-1.5 text-right font-data text-[13px] tabular-nums text-[var(--ink-primary)] focus:border-[var(--accent-color)] focus:outline-none"
        />
      </div>
      <p className="mt-1 flex items-baseline justify-between gap-3 font-body text-[11px] text-[var(--ink-tertiary)]">
        <span>{hint}</span>
        <span className="font-data tabular-nums">{unit}</span>
      </p>
    </div>
  )
}
