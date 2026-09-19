"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatDayShort, formatInt, formatUsdEstimate } from "@/lib/format"
import type { EarningsPoint } from "@/lib/dashboard-api"

const TICK = { fontSize: 10, fontFamily: "var(--font-data)", fill: "var(--ink-tertiary)" }

function plural(n: number, word: string): string {
  return `${formatInt(n)} ${word}${n === 1 ? "" : "s"}`
}

interface TipProps {
  active?: boolean
  payload?: { payload: EarningsPoint }[]
}

function ChartTip({ active, payload }: TipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="border border-[var(--rule-default)] bg-[var(--bg-elevated)] px-3 py-2">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {formatDayShort(point.date)}
      </p>
      <p className="mt-1 font-data text-[11px] tabular-nums text-[var(--ink-primary)]">
        {formatUsdEstimate(point.earned)} · {plural(point.impressions, "ad")} ·{" "}
        {plural(point.clicks, "click")}
      </p>
    </div>
  )
}

export function EarningsChart({ points }: { points: EarningsPoint[] }) {
  const first = points[0]?.date
  const last = points[points.length - 1]?.date
  const ticks = first && last ? (first === last ? [first] : [first, last]) : []

  return (
    <section className="border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-default)] px-4 py-3">
        <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
          Last 30 days
        </h2>
        <span className="font-body text-[11px] text-[var(--ink-tertiary)]">
          estimated per day, utc
        </span>
      </header>
      <div className="px-2 pb-2 pt-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={points} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="earned-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--rule-default)" strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              interval={0}
              tickFormatter={formatDayShort}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--rule-default)" }}
            />
            <YAxis
              width={60}
              tickCount={4}
              tickFormatter={(v: number) => formatUsdEstimate(v)}
              tick={TICK}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<ChartTip />}
              cursor={{ stroke: "var(--rule-strong)", strokeDasharray: "2 2" }}
            />
            <Area
              type="monotone"
              dataKey="earned"
              stroke="var(--accent-color)"
              strokeWidth={1.5}
              fill="url(#earned-fill)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: "var(--accent-color)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
