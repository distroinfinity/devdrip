"use client"
import { SharpInput } from "@/components/v5/sharp-input"
import { InlineHelp } from "@/components/v5/inline-help"

interface Props {
  startMinutes: number | null
  endMinutes: number | null
  tzOffsetMinutes: number
  onChange: (next: { startMinutes: number | null; endMinutes: number | null }) => void
  disabled?: boolean
}

function minutesToHHMM(m: number | null): string {
  if (m == null) return ""
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function hhmmToMinutes(s: string): number | null {
  if (!s) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function QuietHoursBlock({
  startMinutes,
  endMinutes,
  tzOffsetMinutes,
  onChange,
  disabled,
}: Props) {
  const hours = tzOffsetMinutes / 60
  const tzLabel = `UTC${hours >= 0 ? "+" : ""}${hours.toFixed(2).replace(/\.00$/, "")}`
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[10px] font-[var(--font-display)] tracking-[0.08em] uppercase text-[var(--ink-tertiary)]">
          window
        </span>
        <InlineHelp>
          alerts are suppressed during this window. they re-fire after it ends if the breach still
          applies. set both fields to empty to disable.
        </InlineHelp>
      </div>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-[10px] font-[var(--font-display)] tracking-[0.08em] uppercase text-[var(--ink-tertiary)]">
            start
          </label>
          <SharpInput
            type="time"
            value={minutesToHHMM(startMinutes)}
            onChange={(e) => onChange({ startMinutes: hhmmToMinutes(e.target.value), endMinutes })}
            disabled={disabled}
            className="w-32 font-[var(--font-data)]"
          />
        </div>
        <div className="text-[var(--ink-tertiary)] mb-2">→</div>
        <div>
          <label className="block text-[10px] font-[var(--font-display)] tracking-[0.08em] uppercase text-[var(--ink-tertiary)]">
            end
          </label>
          <SharpInput
            type="time"
            value={minutesToHHMM(endMinutes)}
            onChange={(e) => onChange({ startMinutes, endMinutes: hhmmToMinutes(e.target.value) })}
            disabled={disabled}
            className="w-32 font-[var(--font-data)]"
          />
        </div>
        <span className="text-[10px] font-[var(--font-data)] text-[var(--ink-tertiary)] mb-2">
          {tzLabel}
        </span>
      </div>
      <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
        Alerts are suppressed during this window. They re-fire after it ends if the breach persists.
        Set both to empty to disable.
      </p>
    </div>
  )
}
