"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { formatInt } from "@/lib/format"
import type { AnalyticsBreakdowns } from "@/lib/dashboard-api"

interface OutcomesDonutProps {
  byResult: AnalyticsBreakdowns["byResult"]
}

const RESULT_COLOR: Record<string, string> = {
  completed: "var(--accent-color)",
  skipped: "var(--ink-tertiary)",
  expired: "var(--rule-strong)",
  interrupted: "var(--status-caution)",
}

const RESULT_ORDER = ["completed", "skipped", "expired", "interrupted"]

export function OutcomesDonut({ byResult }: OutcomesDonutProps) {
  const sorted = [...byResult].sort(
    (a, b) => RESULT_ORDER.indexOf(a.result) - RESULT_ORDER.indexOf(b.result)
  )
  const total = sorted.reduce((s, r) => s + r.impressions, 0)

  return (
    <section className="flex flex-col rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-5 md:px-6">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        Outcomes
      </p>

      {total === 0 ? (
        <p className="mt-4 font-body text-[12px] text-[var(--ink-tertiary)]">no data</p>
      ) : (
        <div className="mt-3 flex items-center gap-6">
          <div className="h-[140px] w-[140px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sorted}
                  dataKey="impressions"
                  nameKey="result"
                  innerRadius={42}
                  outerRadius={64}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                >
                  {sorted.map((s) => (
                    <Cell key={s.result} fill={RESULT_COLOR[s.result] ?? "var(--ink-tertiary)"} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    return (
                      <div className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-elevated)] px-3 py-2 shadow-sm">
                        <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
                          {p.name}
                        </p>
                        <p className="mt-1 font-data text-[12px] tabular-nums text-[var(--ink-primary)]">
                          {formatInt(Number(p.value ?? 0))}
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex-1 space-y-1.5">
            {sorted.map((s) => {
              const pct = total > 0 ? (s.impressions / total) * 100 : 0
              return (
                <li key={s.result} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-pill"
                    style={{ background: RESULT_COLOR[s.result] ?? "var(--ink-tertiary)" }}
                  />
                  <span className="font-body text-[12px] capitalize text-[var(--ink-secondary)]">
                    {s.result}
                  </span>
                  <span className="ml-auto font-data text-[12px] tabular-nums text-[var(--ink-primary)]">
                    {formatInt(s.impressions)}
                  </span>
                  <span className="font-data text-[10px] tabular-nums text-[var(--ink-tertiary)]">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
