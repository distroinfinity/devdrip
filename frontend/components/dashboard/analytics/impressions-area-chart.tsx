"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AnalyticsSeriesPoint } from "@/lib/dashboard-api"
import { formatDayShort, formatInt } from "@/lib/format"

interface ImpressionsAreaChartProps {
  series: AnalyticsSeriesPoint[]
}

interface TooltipEntry {
  payload?: AnalyticsSeriesPoint
  value?: number
  dataKey?: string
}

export function ImpressionsAreaChart({ series }: ImpressionsAreaChartProps) {
  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 pb-4 pt-5 md:px-6 md:pb-5 md:pt-6">
      <div className="mb-4 flex items-baseline justify-between px-1">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Impressions over time
        </p>
        <p className="font-body text-[11px] text-[var(--ink-tertiary)]">shown vs. completed</p>
      </div>
      <div className="h-[240px] w-full md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="impFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              width={44}
              tickFormatter={(v: number) => formatInt(v)}
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
            <Area
              type="monotone"
              dataKey="impressions"
              stroke="var(--accent-color)"
              strokeWidth={1.5}
              fill="url(#impFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="var(--ink-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null
  const first = payload[0]
  if (!first?.payload) return null
  const point = first.payload
  return (
    <div className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-elevated)] px-3 py-2 shadow-sm">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {formatDayShort(point.date)}
      </p>
      <div className="mt-1 space-y-0.5">
        <p className="font-data text-[12px] tabular-nums text-[var(--ink-primary)]">
          {formatInt(point.impressions)} shown
        </p>
        <p className="font-data text-[11px] tabular-nums text-[var(--ink-secondary)]">
          {formatInt(point.completed)} completed
        </p>
      </div>
    </div>
  )
}
