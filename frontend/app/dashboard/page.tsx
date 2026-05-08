import { redirect } from "next/navigation"
import { getSession, getSessionToken } from "@/lib/session"
import { apiFetchOrRefresh } from "@/lib/api"
import type {
  SyncedPreferences,
  ChannelDto,
  WatchlistDto,
  AlertDto,
  ActivitySummaryDto,
  SparklineDto,
} from "@distrotv/shared"
import { OverviewClient } from "@/components/dashboard/overview/overview-client"
import type { NewsRowData } from "@/components/dashboard/overview/news-row"
import type { ReadingListResponse } from "@/lib/dashboard-api"

interface PrefsPayload {
  preferences: SyncedPreferences
}

interface RecentNewsPayload {
  items: NewsRowData[]
}

export default async function DashboardOverview() {
  const session = await getSession()
  const token = await getSessionToken()

  if (!session || !token) redirect("/sign-in?next=/dashboard")

  const [prefs, channels, watchlists, , summary, sparklines, recentNews, reading] =
    await Promise.all([
      apiFetchOrRefresh<PrefsPayload>("/me/preferences", "/dashboard").catch(
        (): PrefsPayload => ({ preferences: {} as SyncedPreferences })
      ),
      apiFetchOrRefresh<{ channels: ChannelDto[] }>("/me/channels", "/dashboard").catch(() => ({
        channels: [] as ChannelDto[],
      })),
      apiFetchOrRefresh<{ watchlists: WatchlistDto[] }>("/me/watchlists", "/dashboard").catch(
        () => ({ watchlists: [] as WatchlistDto[] })
      ),
      apiFetchOrRefresh<{ alerts: AlertDto[] }>("/me/alerts", "/dashboard").catch(() => ({
        alerts: [] as AlertDto[],
      })),
      apiFetchOrRefresh<ActivitySummaryDto>(
        "/me/activity-summary?windowSec=86400",
        "/dashboard"
      ).catch(
        (): ActivitySummaryDto => ({
          windowSec: 86400,
          events: [],
          totals: { news: 0, ticker: 0, alert: 0, uptime_days: 0 },
        })
      ),
      apiFetchOrRefresh<{ sparklines: SparklineDto[] }>(
        "/me/watchlist/sparklines?windowSec=86400",
        "/dashboard"
      ).catch(() => ({ sparklines: [] as SparklineDto[] })),
      apiFetchOrRefresh<RecentNewsPayload>("/me/recent-news?limit=25", "/dashboard").catch(() => ({
        items: [] as NewsRowData[],
      })),
      apiFetchOrRefresh<ReadingListResponse>("/me/reading?limit=100", "/dashboard").catch(() => ({
        items: [],
        hasMore: false,
      })),
    ])

  return (
    <OverviewClient
      session={session}
      sessionToken={token}
      preferences={prefs.preferences}
      channels={channels.channels}
      watchlists={watchlists.watchlists}
      summary={summary}
      sparklines={sparklines.sparklines}
      recentNews={recentNews.items}
      savedCount={reading.items.length}
    />
  )
}
