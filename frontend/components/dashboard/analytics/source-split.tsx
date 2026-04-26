import { formatUsd, formatInt } from "@/lib/format"
import type { AnalyticsBreakdowns } from "@/lib/dashboard-api"

interface SourceSplitProps {
  bySource: AnalyticsBreakdowns["bySource"]
}

const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct",
  carbon: "Carbon",
  ethicalads: "Ethical Ads",
  google: "Google",
  amazon: "Amazon",
  x402: "x402",
}

export function SourceSplit({ bySource }: SourceSplitProps) {
  const sorted = [...bySource].sort((a, b) => b.impressions - a.impressions)
  const totalImpressions = sorted.reduce((s, r) => s + r.impressions, 0)

  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-5 md:px-6">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Source split
        </p>
        <p className="font-data text-[10px] tabular-nums text-[var(--ink-tertiary)]">
          {formatInt(totalImpressions)} total
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 font-body text-[12px] text-[var(--ink-tertiary)]">no data</p>
      ) : (
        <>
          <div className="mt-4 flex h-2 overflow-hidden rounded-pill bg-[var(--bg-inset)]">
            {sorted.map((row, i) => {
              const pct = totalImpressions > 0 ? (row.impressions / totalImpressions) * 100 : 0
              const palette = [
                "var(--accent-color)",
                "var(--ink-tertiary)",
                "var(--rule-strong)",
                "var(--status-caution)",
              ]
              return (
                <div
                  key={row.source}
                  className="h-full"
                  style={{ width: `${pct}%`, background: palette[i % palette.length] }}
                  title={`${row.source}: ${row.impressions}`}
                />
              )
            })}
          </div>

          <ul className="mt-4 space-y-1.5">
            {sorted.map((row, i) => {
              const palette = [
                "var(--accent-color)",
                "var(--ink-tertiary)",
                "var(--rule-strong)",
                "var(--status-caution)",
              ]
              return (
                <li key={row.source} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-pill"
                    style={{ background: palette[i % palette.length] }}
                  />
                  <span className="font-body text-[12px] text-[var(--ink-primary)]">
                    {SOURCE_LABEL[row.source] ?? row.source}
                  </span>
                  <span className="ml-auto font-data text-[12px] tabular-nums text-[var(--ink-secondary)]">
                    {formatInt(row.impressions)}
                  </span>
                  <span className="font-data text-[11px] tabular-nums text-[var(--ink-tertiary)]">
                    {formatUsd(row.earned)}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
