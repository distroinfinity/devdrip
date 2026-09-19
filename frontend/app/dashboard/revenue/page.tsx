import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { ChartRange, EarningsPoint, EarningsSummary, RecentAd } from "@/lib/dashboard-api"
import { EarningsHero } from "@/components/dashboard/revenue/earnings-hero"
import { StatTiles } from "@/components/dashboard/revenue/stat-tiles"
import { EarningsChart } from "@/components/dashboard/revenue/earnings-chart"
import { RecentAds } from "@/components/dashboard/revenue/recent-ads"

export const dynamic = "force-dynamic"

// the last hour is the default: it is the view that moves while an agent is working
function parseRange(raw: string | string[] | undefined): ChartRange {
  return raw === "24h" || raw === "30d" ? raw : "1h"
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams?: { range?: string | string[] }
}) {
  const range = parseRange(searchParams?.range)
  const back = "/dashboard/revenue"
  const { summary, points, recent } = await apiFetchOrRefresh<{
    summary: EarningsSummary
    points: EarningsPoint[]
    recent: RecentAd[]
  }>(`/me/earnings/overview?range=${range}&limit=20`, back)
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
            <EarningsChart points={points} range={range} />
          </BlurFade>
          <BlurFade delay={0.12} direction="up" offset={6}>
            <RecentAds items={recent} />
          </BlurFade>
        </>
      )}
    </div>
  )
}
