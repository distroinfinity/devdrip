import Link from "next/link"
import { formatInt, formatUsdEstimate } from "@/lib/format"
import type { EarningsSummary } from "@/lib/dashboard-api"

export function EarningsStrip({ summary }: { summary: EarningsSummary }) {
  return (
    <Link
      href="/dashboard/revenue"
      className="group flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-[var(--rule-default)] px-8 py-3 font-data text-[11px] text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent-color)]"
    >
      <span>
        est. today{" "}
        <span className="font-bold tabular-nums text-[var(--ink-primary)]">
          {formatUsdEstimate(summary.today)}
        </span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        all time{" "}
        <span className="font-bold tabular-nums text-[var(--ink-primary)]">
          {formatUsdEstimate(summary.allTime)}
        </span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <span className="font-bold tabular-nums text-[var(--ink-primary)]">
          {formatInt(summary.impressions)}
        </span>{" "}
        ads seen
      </span>
      <span
        aria-hidden="true"
        className="ml-auto text-[var(--ink-secondary)] transition-colors group-hover:text-[var(--accent-color)]"
      >
        →
      </span>
    </Link>
  )
}
