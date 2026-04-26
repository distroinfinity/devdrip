import type { EarningsSummary, EarningsTimeseries } from "@devdrip/shared"
import type { NewsStats } from "@/lib/dashboard-api"
import { EarningsHero } from "@/components/dashboard/earnings-hero"
import { StatGrid } from "@/components/dashboard/stat-grid"
import { EarningsChart } from "@/components/dashboard/earnings-chart"
import { CategoryBars } from "@/components/dashboard/category-bars"
import { FooterStrip } from "@/components/dashboard/footer-strip"
import { EmptyEarnings } from "@/components/dashboard/empty-state"
import { StoriesReadCard } from "@/components/dashboard/stories-read-card"
import { apiFetchOrRefresh } from "@/lib/api"
import { formatTimeHM } from "@/lib/format"

// earnings page is fully server-rendered against /me/earnings/summary +
// /me/earnings/timeseries. 401 → middleware-assisted refresh; on success we pass
// already-fetched data into presentational components.
export default async function DashboardHome() {
  const [summary, series, newsStats] = await Promise.all([
    apiFetchOrRefresh<EarningsSummary>("/me/earnings/summary", "/dashboard"),
    apiFetchOrRefresh<EarningsTimeseries>("/me/earnings/timeseries?days=90", "/dashboard"),
    apiFetchOrRefresh<NewsStats>("/me/news-stats", "/dashboard").catch(() => ({
      thisWeek: 0,
      lastWeek: 0,
    })),
  ])

  const isEmpty = summary.allTime === 0 && summary.totalImpressions === 0

  return (
    <div className="flex flex-col gap-6">
      <EarningsHero balance={summary.balance} streakDays={summary.streakDays} />

      <StoriesReadCard stats={newsStats} />

      {isEmpty ? (
        <EmptyEarnings />
      ) : (
        <>
          <StatGrid
            today={summary.today}
            week={summary.week}
            month={summary.month}
            allTime={summary.allTime}
          />

          <EarningsChart points={series.points} days={series.days} />

          <CategoryBars categories={summary.topCategories} />
        </>
      )}

      <FooterStrip
        totalImpressions={summary.totalImpressions}
        totalClicks={summary.totalClicks}
        updatedAt={formatTimeHM()}
      />
    </div>
  )
}
