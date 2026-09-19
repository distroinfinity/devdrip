import type { ActivitySummaryDto } from "@distrotv/shared"

interface Props {
  summary: ActivitySummaryDto
}

function barHeight(weight: 1 | 2 | 3): number {
  return weight === 1 ? 8 : weight === 2 ? 11 : 14
}

export function ActivityTape({ summary }: Props) {
  const now = Date.now()
  const windowMs = summary.windowSec * 1000
  const start = now - windowMs

  const { totals } = summary

  return (
    <div className="px-8 py-[14px] pb-3 border-b border-[var(--rule-default)]">
      {/* header */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--ink-tertiary)]">
          activity · 24h
        </span>
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-secondary)] tabular-nums">
          <b className="text-[var(--ink-primary)] font-bold">{totals.news + totals.ticker}</b>{" "}
          events &nbsp;·&nbsp;
          <b className="text-[var(--ink-primary)] font-bold">{totals.alert}</b> alerts &nbsp;·&nbsp;
          <b className="text-[var(--ink-primary)] font-bold">{totals.uptime_days}d</b> uptime
        </span>
      </div>

      {/* track */}
      <div
        className="relative h-[22px]"
        style={{
          backgroundImage: "linear-gradient(to right, var(--rule-2, #EEEEEA) 1px, transparent 1px)",
          backgroundSize: "calc(100% / 24) 100%",
        }}
      >
        {summary.events.map((event, i) => {
          const ts = new Date(event.ts).getTime()
          const pct = Math.max(0, Math.min(100, ((ts - start) / windowMs) * 100))

          if (event.kind === "alert") {
            return (
              <div
                key={i}
                className="absolute bottom-0 w-[3px] -translate-x-1/2 bg-[var(--status-negative)]"
                style={{ left: `${pct}%`, height: "22px" }}
              />
            )
          }

          const h = barHeight(event.weight)
          return (
            <div
              key={i}
              className="absolute bottom-0 w-[2px] -translate-x-1/2 bg-[var(--accent-color)]"
              style={{ left: `${pct}%`, height: `${h}px` }}
            />
          )
        })}

        {/* "now" marker at right edge */}
        <div
          className="absolute bottom-0 w-[2px] -translate-x-1/2 bg-[#2F8F4E] h-[22px]"
          style={{
            left: "100%",
            boxShadow: "0 0 8px rgba(47,143,78,0.8)",
          }}
        />
      </div>

      {/* axis */}
      <div className="flex justify-between mt-1.5 font-[var(--font-data)] text-[9px] text-[var(--ink-faint,var(--ink-tertiary))] tracking-[0.06em]">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>NOW</span>
      </div>
    </div>
  )
}
