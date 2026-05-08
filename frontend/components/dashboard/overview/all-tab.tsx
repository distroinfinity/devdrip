import type { ActivitySummaryEvent } from "@distrotv/shared"
import { EmptyState } from "@/components/v5/empty-state"

interface Props {
  events: ActivitySummaryEvent[]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h`
  return `${Math.round(hr / 24)}d`
}

const KIND_CHIP: Record<
  ActivitySummaryEvent["kind"],
  { label: string; bg: string; color: string }
> = {
  news: {
    label: "NEWS",
    bg: "rgba(79,70,229,0.08)",
    color: "var(--accent-color)",
  },
  ticker: {
    label: "TICK",
    bg: "rgba(47,143,78,0.10)",
    color: "#2F8F4E",
  },
  alert: {
    label: "ALRT",
    bg: "var(--status-negative-surface, rgba(193,52,56,0.10))",
    color: "var(--status-negative)",
  },
}

export function AllTab({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="pb-7">
        <EmptyState
          title="no events yet"
          body="slot impressions appear here as your CLI renders content."
        />
      </div>
    )
  }

  return (
    <div className="pb-7">
      {events.slice(0, 50).map((event, i) => {
        const chip = KIND_CHIP[event.kind]
        return (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 border-b border-[var(--rule-2,var(--rule-default))] last:border-b-0"
          >
            <span
              className="font-[var(--font-data)] text-[9px] tracking-[0.04em] uppercase px-1.5 py-[2px] shrink-0"
              style={{ background: chip.bg, color: chip.color }}
            >
              {chip.label}
            </span>
            <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tabular-nums shrink-0 w-10">
              {timeAgo(event.ts)} ago
            </span>
            <span className="font-[var(--font-body)] text-[13px] text-[var(--ink-secondary)] flex-1 min-w-0">
              {event.kind} · weight {event.weight}
            </span>
          </div>
        )
      })}
    </div>
  )
}
