"use client"

import { cn } from "@distrotv/design-system/utils"

interface QuietHoursPickerProps {
  start: number | null
  end: number | null
  tzOffsetMinutes: number
  onChange: (patch: { quietHoursStart?: number | null; quietHoursEnd?: number | null }) => void
  disabled?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function QuietHoursPicker({
  start,
  end,
  tzOffsetMinutes,
  onChange,
  disabled,
}: QuietHoursPickerProps) {
  const enabled = start !== null && end !== null

  function toggleEnabled(): void {
    if (disabled) return
    if (enabled) {
      onChange({ quietHoursStart: null, quietHoursEnd: null })
    } else {
      onChange({ quietHoursStart: 22, quietHoursEnd: 7 })
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-body text-[12px] text-[var(--ink-secondary)]">
          {enabled ? "no ads between these hours (local time)" : "ads will be served at any hour"}
        </p>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={disabled}
          className={cn(
            "rounded-pill border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
            enabled
              ? "border-[var(--accent-color)] bg-[var(--accent-glow)] text-[var(--accent-color)]"
              : "border-[var(--rule-default)] bg-[var(--bg-inset)] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
          )}
        >
          {enabled ? "on" : "off"}
        </button>
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="from">
            <HourSelect
              value={start ?? 22}
              disabled={disabled}
              onChange={(v) => onChange({ quietHoursStart: v })}
            />
          </Field>
          <Field label="to">
            <HourSelect
              value={end ?? 7}
              disabled={disabled}
              onChange={(v) => onChange({ quietHoursEnd: v })}
            />
          </Field>
        </div>
      )}

      <p className="mt-3 font-display text-[9px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        timezone offset {formatTzOffset(tzOffsetMinutes)} (auto-detected)
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {label}
      </span>
      {children}
    </label>
  )
}

function HourSelect({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-3 py-2 font-data text-[13px] tabular-nums text-[var(--ink-primary)] focus:border-[var(--accent-color)] focus:outline-none"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {h.toString().padStart(2, "0")}:00
        </option>
      ))}
    </select>
  )
}

function formatTzOffset(min: number): string {
  const sign = min >= 0 ? "+" : "-"
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m > 0 ? `:${m.toString().padStart(2, "0")}` : ""}`
}
