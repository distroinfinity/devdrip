"use client"

import { useState, useCallback } from "react"
import type {
  SyncedPreferences,
  ChannelDto,
  WatchlistDto,
  ActivitySummaryDto,
  SparklineDto,
  NowPlayingDto,
  AlertEventDto,
} from "@distrotv/shared"
import { ChannelMode } from "@distrotv/shared"
import type { SessionPayload } from "@/lib/session"
import { ModePill } from "@/components/dashboard/mode-pill"
import { SetupBanner } from "./setup-banner"
import { LiveBar } from "./live-bar"
import { ActivityTape } from "./activity-tape"
import { TerminalMirror } from "./terminal-mirror"
import { FeedTabs, type TabId } from "./feed-tabs"
import { NewsTab } from "./news-tab"
import { WatchlistTab } from "./watchlist-tab"
import { AlertsTab } from "./alerts-tab"
import { AllTab } from "./all-tab"
import { FooterStats } from "./footer-stats"
import type { NewsRowData } from "./news-row"

interface Props {
  session: SessionPayload
  sessionToken: string
  preferences: SyncedPreferences
  channels: ChannelDto[]
  watchlists: WatchlistDto[]
  summary: ActivitySummaryDto
  sparklines: SparklineDto[]
  recentNews: NewsRowData[]
  alertEvents: AlertEventDto[]
  savedCount: number
}

function defaultTab(mode: ChannelMode): TabId {
  if (mode === ChannelMode.TickerHeavy || mode === ChannelMode.TickerOnly) return "watchlist"
  return "news"
}

function getMarketStatus(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const hour = now.getUTCHours()
  // NYSE: 9:30-16:00 ET = 14:30-21:00 UTC (rough, ignores DST edge cases)
  const isWeekday = day >= 1 && day <= 5
  const isMarketHours = hour >= 14 && hour < 21
  if (!isWeekday) return "NYSE closed"
  if (!isMarketHours) return "NYSE closed"
  return "NYSE open"
}

function getDateMeta(): string {
  const now = new Date()
  const day = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  const month = now.toLocaleDateString("en-US", { month: "long" }).toLowerCase()
  const date = now.getDate()
  return `${day} · ${month} ${date} · ${getMarketStatus()}`
}

export function OverviewClient({
  session,
  sessionToken,
  preferences,
  channels,
  watchlists,
  summary,
  sparklines,
  recentNews,
  alertEvents,
  savedCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab(preferences.channelMode))
  const [liveNow, setLiveNow] = useState<NowPlayingDto | null>(null)

  const handleNowChange = useCallback((now: NowPlayingDto | null) => {
    setLiveNow(now)
  }, [])

  const alertCount = summary.totals.alert
  const allTickers = watchlists.flatMap((w) => w.tickers)

  const tabs = [
    { id: "news" as TabId, label: "News", count: recentNews.length },
    { id: "watchlist" as TabId, label: "Watchlist", count: allTickers.length },
    { id: "alerts" as TabId, label: "Alerts", count: alertCount },
    { id: "all" as TabId, label: "All" },
  ]

  return (
    <div className="flex flex-col">
      {/* setup banner */}
      <SetupBanner channels={channels} watchlists={watchlists} />

      {/* page header */}
      <div
        className="flex items-baseline gap-4 border-b border-[var(--rule-default)]"
        style={{ padding: "22px 32px 16px" }}
      >
        <span className="font-[var(--font-display)] text-[14px] font-bold tracking-tight">
          overview
        </span>
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tracking-[0.04em]">
          {getDateMeta()}
        </span>
        <div className="ml-auto">
          <ModePill initial={preferences.channelMode} />
        </div>
      </div>

      {/* live bar */}
      <LiveBar now={liveNow} />

      {/* activity tape */}
      <ActivityTape summary={summary} />

      {/* terminal mirror */}
      {session.deviceId && (
        <TerminalMirror
          deviceId={session.deviceId}
          token={sessionToken}
          onNowChange={handleNowChange}
        />
      )}

      {/* tab bar */}
      <FeedTabs active={activeTab} tabs={tabs} onChange={setActiveTab} />

      {/* tab content */}
      <div className="px-8 pt-1.5">
        {activeTab === "news" && <NewsTab items={recentNews} />}
        {activeTab === "watchlist" && (
          <WatchlistTab watchlists={watchlists} sparklines={sparklines} />
        )}
        {activeTab === "alerts" && <AlertsTab events={alertEvents} />}
        {activeTab === "all" && <AllTab events={summary.events} />}
      </div>

      {/* footer stats */}
      <FooterStats summary={summary} savedCount={savedCount} lastSyncSec={2} />
    </div>
  )
}
