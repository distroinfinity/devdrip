"use client"

import type { MetricsDto } from "@/lib/admin-api"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const ACCENT = "#4F46E5"
const POSITIVE = "#2F8F4E"
const NEGATIVE = "#C13438"
const ACCENT_LIGHT = "#A5B4FC"

export function MetricsCharts({ data }: { data: MetricsDto }) {
  return (
    <div className="p-8 space-y-6">
      <h1 className="font-[var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
        metrics · last 30d
      </h1>

      <ChartCard title="slot delivery / day">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data.slotsByDay}>
            <CartesianGrid stroke="#DDDDD8" strokeDasharray="2 2" />
            <XAxis
              dataKey="day"
              stroke="#9C9CA5"
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            />
            <YAxis stroke="#9C9CA5" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <Tooltip contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="news"
              stackId="1"
              fill={ACCENT}
              stroke={ACCENT}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="ticker"
              stackId="1"
              fill={ACCENT_LIGHT}
              stroke={ACCENT_LIGHT}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="alert"
              stackId="1"
              fill={NEGATIVE}
              stroke={NEGATIVE}
              fillOpacity={0.4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="save rate / day">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data.saveRateByDay}>
            <CartesianGrid stroke="#DDDDD8" strokeDasharray="2 2" />
            <XAxis
              dataKey="day"
              stroke="#9C9CA5"
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            />
            <YAxis
              stroke="#9C9CA5"
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }}
              formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "rate"]}
            />
            <Line type="monotone" dataKey="rate" stroke={POSITIVE} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="mode distribution">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.modeDistribution} layout="vertical">
              <CartesianGrid stroke="#DDDDD8" strokeDasharray="2 2" horizontal={false} />
              <XAxis
                type="number"
                stroke="#9C9CA5"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
              />
              <YAxis
                dataKey="mode"
                type="category"
                stroke="#9C9CA5"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                width={80}
              />
              <Tooltip contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <Bar dataKey="count" fill={ACCENT} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="news ctr by source">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.newsCtrBySource} layout="vertical">
              <CartesianGrid stroke="#DDDDD8" strokeDasharray="2 2" horizontal={false} />
              <XAxis
                type="number"
                stroke="#9C9CA5"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <YAxis
                dataKey="source"
                type="category"
                stroke="#9C9CA5"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                width={80}
              />
              <Tooltip
                contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }}
                formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "ctr"]}
              />
              <Bar dataKey="ctr" fill={ACCENT} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="alerts / day">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data.alertsByDay}>
            <CartesianGrid stroke="#DDDDD8" strokeDasharray="2 2" />
            <XAxis
              dataKey="day"
              stroke="#9C9CA5"
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            />
            <YAxis stroke="#9C9CA5" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <Tooltip contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
            <Bar dataKey="count" fill={NEGATIVE} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <div className="px-4 py-3 border-b border-[var(--rule-default)]">
        <span className="font-[var(--font-display)] text-[10px] tracking-[0.1em] uppercase text-[var(--ink-secondary)] font-bold">
          {title}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}
