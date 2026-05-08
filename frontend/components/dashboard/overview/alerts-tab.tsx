import type { AlertEventDto } from "@distrotv/shared"
import { EmptyState } from "@/components/v5/empty-state"

function formatRelative(iso: string): string {
  const now = Date.now()
  const ms = now - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} today`
  }
  const hr = Math.floor(min / 60)
  if (hr < 24) {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} today`
  }
  const day = Math.floor(hr / 24)
  if (day === 1) return "yesterday"
  return `${day}d ago`
}

function pctColor(pct: number): string {
  if (pct > 0) return "var(--color-forest, #2F8F4E)"
  if (pct < 0) return "var(--color-oxblood, #C13438)"
  return "var(--ink-tertiary)"
}

interface Props {
  events: AlertEventDto[]
}

export function AlertsTab({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="pb-7">
        <EmptyState
          title="no alerts fired yet"
          body="alerts trigger when a watched ticker moves more than your threshold (default ±5%)"
        />
      </div>
    )
  }

  return (
    <div className="pb-7">
      <div className="flex flex-col divide-y divide-[var(--rule-default)]">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 py-2.5">
            {/* when */}
            <span className="w-[88px] shrink-0 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tabular-nums">
              {formatRelative(ev.firedAt)}
            </span>

            {/* what */}
            <div className="flex-1 flex items-center gap-2">
              <span className="font-[var(--font-data)] text-[12px] font-bold text-[var(--ink-primary)] tracking-[0.04em]">
                {ev.symbol}
              </span>
              <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
                breach
              </span>
              <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-faint,var(--ink-tertiary))]">
                ±{ev.thresholdPct}% threshold
              </span>
            </div>

            {/* pct */}
            <span
              className="font-[var(--font-data)] text-[11px] tabular-nums font-medium"
              style={{ color: pctColor(ev.changePct) }}
            >
              {ev.changePct >= 0 ? "+" : ""}
              {ev.changePct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
