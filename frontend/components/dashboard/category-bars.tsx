import { categoryLabel } from "@/lib/categories"
import { formatUsd } from "@/lib/format"

interface CategoryBarsProps {
  categories: { category: string; amountUsdc: number }[]
}

export function CategoryBars({ categories }: CategoryBarsProps) {
  const total = categories.reduce((acc, c) => acc + c.amountUsdc, 0)
  const max = Math.max(...categories.map((c) => c.amountUsdc), 0)

  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-5 py-5 md:px-6 md:py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Top Categories
        </p>
        <p className="font-body text-[11px] text-[var(--ink-tertiary)]">by all-time earnings</p>
      </div>

      {categories.length === 0 ? (
        <p className="font-body text-[12px] text-[var(--ink-tertiary)]">
          no earnings yet — once impressions run, category breakdown will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {categories.map((cat, idx) => {
            const widthPct = max > 0 ? Math.max(4, (cat.amountUsdc / max) * 100) : 4
            const pct = total > 0 ? (cat.amountUsdc / total) * 100 : 0
            return (
              <li key={cat.category} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-body text-[13px] text-[var(--ink-primary)]">
                    {categoryLabel(cat.category)}
                  </span>
                  <span className="font-data text-[13px] font-medium tabular-nums text-[var(--ink-secondary)]">
                    {formatUsd(cat.amountUsdc)}
                    <span className="ml-2 font-body text-[11px] text-[var(--ink-tertiary)]">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-[6px] w-full overflow-hidden rounded-pill bg-[var(--bg-inset)]">
                  <div
                    className="h-full rounded-pill transition-[width] duration-500"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: idx === 0 ? "var(--accent-color)" : "var(--ink-primary)",
                      opacity: idx === 0 ? 1 : 0.5,
                    }}
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
