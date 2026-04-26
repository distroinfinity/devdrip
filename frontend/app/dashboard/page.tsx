import type { EarningsSummary, EarningsTimeseries } from "@devdrip/shared"
import { ChannelMode } from "@devdrip/shared"
import { EarningsHero } from "@/components/dashboard/earnings-hero"
import { StatGrid } from "@/components/dashboard/stat-grid"
import { EarningsChart } from "@/components/dashboard/earnings-chart"
import { CategoryBars } from "@/components/dashboard/category-bars"
import { FooterStrip } from "@/components/dashboard/footer-strip"
import { EmptyEarnings } from "@/components/dashboard/empty-state"
import { StoriesReadCard } from "@/components/dashboard/stories-read-card"
import { LearnModeNotice } from "@/components/dashboard/learn-mode-notice"
import { SavedStoriesPreview } from "@/components/dashboard/saved-stories-preview"
import { apiFetchOrRefresh } from "@/lib/api"
import { formatTimeHM } from "@/lib/format"
import type { NewsStats, PreferencesPayload, ReadingListResponse } from "@/lib/dashboard-api"

// earnings page is fully server-rendered against /me/earnings/summary +
// /me/earnings/timeseries. 401 → middleware-assisted refresh; on success we pass
// already-fetched data into presentational components.
export default async function DashboardHome() {
  const [summary, series, newsStats, prefsPayload, readingPreview] = await Promise.all([
    apiFetchOrRefresh<EarningsSummary>("/me/earnings/summary", "/dashboard"),
    apiFetchOrRefresh<EarningsTimeseries>("/me/earnings/timeseries?days=90", "/dashboard"),
    apiFetchOrRefresh<NewsStats>("/me/news-stats", "/dashboard").catch(() => ({
      thisWeek: 0,
      lastWeek: 0,
    })),
    apiFetchOrRefresh<PreferencesPayload>("/me/preferences", "/dashboard").catch(() => null),
    // top-3 saves for the learn-mode preview; fetch shallowly
    apiFetchOrRefresh<ReadingListResponse>("/me/reading?limit=3", "/dashboard").catch(() => ({
      items: [],
      hasMore: false,
    })),
  ])

  const mode = prefsPayload?.preferences.channelMode ?? ChannelMode.Mix
  const isEmpty = summary.allTime === 0 && summary.totalImpressions === 0

  // learn-mode users: pin reading first, collapse earnings to a notice
  if (mode === ChannelMode.Learn) {
    return (
      <div className="flex flex-col gap-6">
        <EarningsHero balance={summary.balance} streakDays={summary.streakDays} />
        <StoriesReadCard stats={newsStats} />
        <SavedStoriesPreview items={readingPreview.items} />
        <LearnModeNotice />
        <FooterStrip
          totalImpressions={summary.totalImpressions}
          totalClicks={summary.totalClicks}
          updatedAt={formatTimeHM()}
        />
      </div>
    )
  }

  // earn or mix: existing layout, with the stories-read card in place
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
