import type { NewsStats } from "@/lib/dashboard-api"

interface StoriesReadCardProps {
  stats: NewsStats
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((current - prev) / prev) * 100)
}

export function StoriesReadCard({ stats }: StoriesReadCardProps) {
  const delta = pctChange(stats.thisWeek, stats.lastWeek)
  const arrow = delta === null ? "" : delta >= 0 ? "↗" : "↘"
  const sign = delta === null ? "" : delta >= 0 ? "+" : ""

  return (
    <div className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-5 py-5 md:px-6 md:py-6">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        Stories read this week
      </p>
      <p className="mt-3 font-data text-data-l font-bold tabular-nums text-[var(--ink-primary)]">
        {stats.thisWeek}
      </p>
      {delta !== null ? (
        <p className="mt-1 font-body text-[11px] text-[var(--ink-tertiary)]">
          {arrow} {sign}
          {delta}% vs last week
        </p>
      ) : stats.thisWeek === 0 ? (
        <p className="mt-1 font-body text-[11px] text-[var(--ink-tertiary)]">
          switch to mix or learn to start reading
        </p>
      ) : (
        <p className="mt-1 font-body text-[11px] text-[var(--ink-tertiary)]">first week</p>
      )}
    </div>
  )
}
