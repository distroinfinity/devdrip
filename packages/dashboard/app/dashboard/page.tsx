import type { EarningsSummary, EarningsTimeseries } from "@devdrip/shared"
import { EarningsHero } from "@/components/earnings-hero"
import { StatGrid } from "@/components/stat-grid"
import { EarningsChart } from "@/components/earnings-chart"
import { CategoryBars } from "@/components/category-bars"
import { FooterStrip } from "@/components/footer-strip"
import { EmptyEarnings } from "@/components/empty-state"
import { apiFetchOrRefresh } from "@/lib/api"
import { formatTimeHM } from "@/lib/format"

// earnings page is fully server-rendered against /me/earnings/summary +
// /me/earnings/timeseries. 401 → middleware-assisted refresh; on success we pass
// already-fetched data into presentational components.
export default async function DashboardHome() {
  const [summary, series] = await Promise.all([
    apiFetchOrRefresh<EarningsSummary>("/me/earnings/summary", "/dashboard"),
    apiFetchOrRefresh<EarningsTimeseries>("/me/earnings/timeseries?days=90", "/dashboard"),
  ])

  const isEmpty = summary.allTime === 0 && summary.totalImpressions === 0

  return (
    <div className="flex flex-col gap-6">
      <EarningsHero balance={summary.balance} streakDays={summary.streakDays} />

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
