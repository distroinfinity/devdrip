import { BlurFade } from "@devdrip/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { AnalyticsResponse } from "@/lib/dashboard-api"
import { RangeSelector } from "@/components/dashboard/analytics/range-selector"
import { ImpressionsAreaChart } from "@/components/dashboard/analytics/impressions-area-chart"
import { AnalyticsCategoryBars } from "@/components/dashboard/analytics/category-bars"
import { OutcomesDonut } from "@/components/dashboard/analytics/outcomes-donut"
import { SourceSplit } from "@/components/dashboard/analytics/source-split"
import { CtrTile } from "@/components/dashboard/analytics/ctr-tile"
import { EmptyAnalytics } from "@/components/dashboard/analytics/empty-analytics"

export const dynamic = "force-dynamic"

interface AnalyticsPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.length > 0) return v
  if (Array.isArray(v) && typeof v[0] === "string") return v[0]
  return undefined
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const fromParam = pickString(searchParams?.["from"])
  const toParam = pickString(searchParams?.["to"])

  // default 30d window when no range provided. The selector writes from/to to
  // the URL so the server-rendered fetch matches the visible state.
  const to = toParam ? new Date(toParam) : new Date()
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 86_400_000)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))

  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  }).toString()

  const data = await apiFetchOrRefresh<AnalyticsResponse>(
    `/me/analytics/impressions?${qs}`,
    "/dashboard/analytics"
  )

  const isEmpty = data.totals.impressions === 0

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
              Analytics
            </p>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
              what&apos;s working
            </h1>
            <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
              last {days} days · {data.totals.impressions.toLocaleString("en-US")} impressions · $
              {data.totals.earned.toFixed(2)} earned
            </p>
          </div>
          <RangeSelector activeDays={days} />
        </div>
      </BlurFade>

      {isEmpty ? (
        <BlurFade delay={0.04}>
          <EmptyAnalytics />
        </BlurFade>
      ) : (
        <>
          <BlurFade delay={0.04} direction="up" offset={6}>
            <ImpressionsAreaChart series={data.series} />
          </BlurFade>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BlurFade delay={0.08} direction="up" offset={6}>
              <AnalyticsCategoryBars byCategory={data.breakdowns.byCategory} />
            </BlurFade>
            <BlurFade delay={0.12} direction="up" offset={6}>
              <OutcomesDonut byResult={data.breakdowns.byResult} />
            </BlurFade>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BlurFade delay={0.16} direction="up" offset={6}>
              <SourceSplit bySource={data.breakdowns.bySource} />
            </BlurFade>
            <BlurFade delay={0.2} direction="up" offset={6}>
              <CtrTile
                clicks={data.totals.clicks}
                completed={data.totals.completed}
                earned={data.totals.earned}
                impressions={data.totals.impressions}
              />
            </BlurFade>
          </div>
        </>
      )}
    </div>
  )
}
