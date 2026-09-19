import { categoryLabel } from "@/lib/categories"
import { formatUsd } from "@/lib/format"
import type { AnalyticsBreakdowns } from "@/lib/dashboard-api"

interface AnalyticsCategoryBarsProps {
  byCategory: AnalyticsBreakdowns["byCategory"]
}

export function AnalyticsCategoryBars({ byCategory }: AnalyticsCategoryBarsProps) {
  const sorted = [...byCategory].sort((a, b) => b.earned - a.earned).slice(0, 5)
  const max = sorted.reduce((m, r) => Math.max(m, r.earned), 0)

  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-5 md:px-6">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        Earnings by category
      </p>
      {sorted.length === 0 ? (
        <p className="mt-4 font-body text-[12px] text-[var(--ink-tertiary)]">no data</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((row) => {
            const pct = max > 0 ? (row.earned / max) * 100 : 0
            return (
              <li key={row.category}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-body text-[12px] text-[var(--ink-primary)]">
                    {categoryLabel(row.category)}
                  </span>
                  <span className="font-data text-[12px] tabular-nums text-[var(--ink-secondary)]">
                    {formatUsd(row.earned)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-pill bg-[var(--bg-inset)]">
                  <div
                    className="h-full rounded-pill bg-[var(--accent-color)]"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
