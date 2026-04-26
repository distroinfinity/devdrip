import { formatUsd } from "@/lib/format"

interface StatGridProps {
  today: number
  week: number
  month: number
  allTime: number
}

const CELLS: Array<{ key: keyof StatGridProps; label: string; sub: string }> = [
  { key: "today", label: "Today", sub: "since midnight" },
  { key: "week", label: "This Week", sub: "Mon — now" },
  { key: "month", label: "This Month", sub: "1st — now" },
  { key: "allTime", label: "All-Time", sub: "since day zero" },
]

export function StatGrid(props: StatGridProps) {
  return (
    <section
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--rule-subtle)] md:grid-cols-4"
      aria-label="Earnings breakdown"
    >
      {CELLS.map((cell) => (
        <div key={cell.key} className="bg-[var(--bg-surface)] px-5 py-5 md:px-6 md:py-6">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            {cell.label}
          </p>
          <p className="mt-3 font-data text-data-l font-bold tabular-nums text-[var(--ink-primary)]">
            {formatUsd(props[cell.key])}
          </p>
          <p className="mt-1 font-body text-[11px] text-[var(--ink-tertiary)]">{cell.sub}</p>
        </div>
      ))}
    </section>
  )
}
