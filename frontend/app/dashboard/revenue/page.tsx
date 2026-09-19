import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { EarningsPoint, EarningsSummary, RecentAd } from "@/lib/dashboard-api"
import { EarningsHero } from "@/components/dashboard/revenue/earnings-hero"
import { StatTiles } from "@/components/dashboard/revenue/stat-tiles"
import { EarningsChart } from "@/components/dashboard/revenue/earnings-chart"
import { RecentAds } from "@/components/dashboard/revenue/recent-ads"

export const dynamic = "force-dynamic"

export default async function RevenuePage() {
  const back = "/dashboard/revenue"
  const [summary, series, recent] = await Promise.all([
    apiFetchOrRefresh<EarningsSummary>("/me/earnings/summary", back),
    apiFetchOrRefresh<{ points: EarningsPoint[] }>("/me/earnings/timeseries?days=30", back),
    apiFetchOrRefresh<{ items: RecentAd[] }>("/me/earnings/recent?limit=20", back),
  ])
  const empty = summary.impressions === 0 && summary.clicks === 0

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <EarningsHero summary={summary} />
      </BlurFade>

      {empty ? (
        <BlurFade delay={0.04} direction="up" offset={6}>
          <div className="border border-dashed border-[var(--rule-default)] p-6">
            <h2 className="font-display text-[15px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
              no ads seen yet
            </h2>
            <p className="mt-2 max-w-[64ch] font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
              Start a Claude Code session and let your agent work — sponsored slots appear in the
              status line, and your estimated share shows up here.
            </p>
          </div>
        </BlurFade>
      ) : (
        <>
          <BlurFade delay={0.04} direction="up" offset={6}>
            <StatTiles summary={summary} />
          </BlurFade>
          <BlurFade delay={0.08} direction="up" offset={6}>
            <EarningsChart points={series.points} />
          </BlurFade>
          <BlurFade delay={0.12} direction="up" offset={6}>
            <RecentAds items={recent.items} />
          </BlurFade>
        </>
      )}
    </div>
  )
}
