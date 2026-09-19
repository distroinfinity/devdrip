import { formatInt, formatUsdEstimate } from "@/lib/format"
import type { EarningsSummary } from "@/lib/dashboard-api"

// "20m 48s" / "1h 04m" — how long paid ads were actually on screen
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`
  return `${s}s`
}

interface Tile {
  label: string
  value: string
  sub?: string
}

export function StatTiles({ summary }: { summary: EarningsSummary }) {
  const tiles: Tile[] = [
    { label: "Today", value: formatUsdEstimate(summary.today), sub: "estimated" },
    {
      label: "Per agent-hour",
      value: summary.ratePerHour > 0 ? formatUsdEstimate(summary.ratePerHour) : "—",
      sub: "estimated, while ads play",
    },
    { label: "Agent time paid", value: formatDuration(summary.viewMs), sub: "ads on screen" },
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
