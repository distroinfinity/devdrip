import type { ActivitySummaryDto } from "@distrotv/shared"

interface Props {
  summary: ActivitySummaryDto
  savedCount: number
  lastSyncSec?: number
}

export function FooterStats({ summary, savedCount, lastSyncSec }: Props) {
  const totalEvents = summary.totals.news + summary.totals.ticker
  const { alert: alertCount, uptime_days } = summary.totals

  return (
    <div className="px-8 py-4 border-t border-[var(--rule-default)]">
      <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
        ▸ <span className="text-[var(--ink-primary)] font-bold">{totalEvents}</span> events / 7d
        {" · "}
        <span className="text-[var(--ink-primary)] font-bold">{savedCount}</span> saved
        {" · "}
        <span className="text-[var(--ink-primary)] font-bold">{alertCount}</span> alerts
        {" · "}
        <span className="text-[var(--ink-primary)] font-bold">{uptime_days}d</span> uptime
        {lastSyncSec !== undefined && (
          <>
            {" · "}
            last sync {lastSyncSec}s
          </>
        )}
      </span>
    </div>
  )
}
