"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { EarningsTimeseriesPoint } from "@distrotv/shared"
import { formatDayShort, formatUsd, formatUsdCompact } from "@/lib/format"

interface EarningsChartProps {
  points: EarningsTimeseriesPoint[]
  days: number
}

interface TooltipPayloadEntry {
  value?: number
  payload?: EarningsTimeseriesPoint
}

export function EarningsChart({ points, days }: EarningsChartProps) {
  const hasData = points.some((p) => p.amount > 0)

  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 pb-4 pt-5 md:px-6 md:pb-5 md:pt-6">
      <div className="mb-4 flex items-baseline justify-between px-1">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Last {days} days
        </p>
        <p className="font-body text-[11px] text-[var(--ink-tertiary)]">daily earnings</p>
      </div>

      <div className="relative h-[200px] w-full md:h-[260px]">
        {!hasData && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <p className="font-body text-[12px] text-[var(--ink-tertiary)]">
              no earnings yet — run <code className="font-data">devdrip auth</code> to start
            </p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--rule-subtle)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayShort}
              stroke="var(--ink-tertiary)"
              tick={{
                fill: "var(--ink-tertiary)",
                fontFamily: "var(--font-display)",
                fontSize: 10,
                letterSpacing: "0.08em",
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--rule-subtle)" }}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              width={52}
              tickFormatter={formatUsdCompact}
              stroke="var(--ink-tertiary)"
              tick={{
                fill: "var(--ink-tertiary)",
                fontFamily: "var(--font-data)",
                fontSize: 10,
              }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
            />
            <Tooltip
              cursor={{ stroke: "var(--rule-default)", strokeDasharray: "2 2" }}
              content={<ChartTooltip />}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--accent-color)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: "var(--accent-color)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null
  const first = payload[0]
  if (!first) return null
  const point = first.payload
  if (!point) return null
  return (
    <div className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-elevated)] px-3 py-2 shadow-sm">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {formatDayShort(point.date)}
      </p>
      <p className="mt-1 font-data text-[14px] font-bold tabular-nums text-[var(--ink-primary)]">
        {formatUsd(point.amount)}
      </p>
    </div>
  )
}
