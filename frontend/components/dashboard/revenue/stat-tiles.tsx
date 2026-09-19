import { formatInt, formatUsdEstimate } from "@/lib/format"
import type { EarningsSummary } from "@/lib/dashboard-api"

interface Tile {
  label: string
  value: string
  sub?: string
}

export function StatTiles({ summary }: { summary: EarningsSummary }) {
  const tiles: Tile[] = [
    { label: "Today", value: formatUsdEstimate(summary.today), sub: "estimated" },
    { label: "Last 7 days", value: formatUsdEstimate(summary.last7d), sub: "estimated" },
    { label: "All time", value: formatUsdEstimate(summary.allTime), sub: "estimated" },
    {
      label: "Ads seen",
      value: formatInt(summary.impressions),
      sub: `of ${formatInt(summary.served)} served`,
    },
    { label: "Clicks", value: formatInt(summary.clicks) },
    { label: "CTR", value: `${(summary.ctr * 100).toFixed(1)}%`, sub: "clicks / seen" },
  ]

  return (
    <dl className="grid grid-cols-2 gap-px border border-[var(--rule-default)] bg-[var(--rule-default)] md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 bg-[var(--bg-surface)] px-4 py-4">
          <dt className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
            {tile.label}
          </dt>
          <dd className="mt-2 truncate font-data text-[20px] leading-none tabular-nums text-[var(--ink-primary)]">
            {tile.value}
          </dd>
          <dd className="mt-2 min-h-[14px] font-body text-[11px] leading-[14px] text-[var(--ink-tertiary)]">
            {tile.sub}
          </dd>
        </div>
      ))}
    </dl>
  )
}
