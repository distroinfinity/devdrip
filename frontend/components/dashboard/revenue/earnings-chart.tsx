"use client"

import Link from "next/link"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatInt, formatUsdEstimate } from "@/lib/format"
import type { ChartRange, EarningsPoint } from "@/lib/dashboard-api"

const TICK = { fontSize: 10, fontFamily: "var(--font-data)", fill: "var(--ink-tertiary)" }

const RANGES: { key: ChartRange; label: string; title: string; note: string }[] = [
  { key: "1h", label: "1H", title: "Last hour", note: "running total, estimated" },
  { key: "24h", label: "24H", title: "Last 24 hours", note: "running total, estimated" },
  { key: "30d", label: "30D", title: "Last 30 days", note: "per day, estimated" },
]

interface ChartPoint extends EarningsPoint {
  // what the area plots: a running total for 1h / 24h, the day's amount for 30d
  plotted: number
}

function plural(n: number, word: string): string {
  return `${formatInt(n)} ${word}${n === 1 ? "" : "s"}`
}

function label(iso: string, range: ChartRange): string {
  const d = new Date(iso)
  if (range === "30d") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
  }
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

interface TipProps {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  range: ChartRange
}

function ChartTip({ active, payload, range }: TipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="border border-[var(--rule-default)] bg-[var(--bg-elevated)] px-3 py-2">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {label(point.date, range)}
      </p>
      <p className="mt-1 font-data text-[11px] tabular-nums text-[var(--ink-primary)]">
        {formatUsdEstimate(point.plotted)}
        {range === "30d" ? "" : " so far"} · {plural(point.impressions, "ad")} ·{" "}
        {plural(point.clicks, "click")}
      </p>
    </div>
  )
}

export function EarningsChart({ points, range }: { points: EarningsPoint[]; range: ChartRange }) {
  const meta = RANGES.find((r) => r.key === range) ?? RANGES[0]
  let running = 0
  const data: ChartPoint[] = points.map((p) => {
    running += p.earned
    return { ...p, plotted: range === "30d" ? p.earned : running }
  })
  const first = data[0]?.date
  const last = data[data.length - 1]?.date
  const ticks = first && last ? (first === last ? [first] : [first, last]) : []

  return (
    <section className="border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule-default)] px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
            {meta?.title}
          </h2>
          <span className="font-body text-[11px] text-[var(--ink-tertiary)]">{meta?.note}</span>
        </div>
        <nav className="flex" aria-label="Chart range">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`?range=${r.key}`}
              scroll={false}
              replace
              aria-current={r.key === range ? "true" : undefined}
              className={`border border-l-0 border-[var(--rule-default)] px-2.5 py-1 font-data text-[10px] tracking-[0.06em] first:border-l focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent-color)] ${
                r.key === range
                  ? "bg-[var(--ink-primary)] text-[var(--bg-primary)]"
                  : "text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="px-2 pb-2 pt-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
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
              tickFormatter={(v: string) => label(v, range)}
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
              content={<ChartTip range={range} />}
              cursor={{ stroke: "var(--rule-strong)", strokeDasharray: "2 2" }}
            />
            <Area
              // a running total only ever steps up, so draw it as steps
              type={range === "30d" ? "monotone" : "stepAfter"}
              dataKey="plotted"
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
