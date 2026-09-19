import type { AdCategory, ChannelMode, Feed, NewsTopic, SyncedPreferences } from "@distrotv/shared"
import { apiFetch } from "./api"

// ── earnings (/me/earnings/*) — every amount is an estimate ────────────────

export interface EarningsSummary {
  today: number
  last7d: number
  allTime: number
  // ads handed to the device vs ads actually seen
  served: number
  impressions: number
  paidImpressions: number
  clicks: number
  // 0..1 fraction
  ctr: number
  // total time paid ads were on screen, and the estimated hourly rate that implies
  viewMs: number
  ratePerHour: number
  lastSeenAt: string | null
  cpmRate: number
  revenueShare: number
  estimated: true
}

export type ChartRange = "1h" | "24h" | "30d"

export interface EarningsPoint {
  date: string
  earned: number
  impressions: number
  clicks: number
}

export interface RecentAd {
  id: string
  advertiser: string
  headline: string
  source: "carbon" | "house"
  durationMs: number
  result: string
  clicked: boolean
  earned: number
  createdAt: string
}

// ── preferences (new GET, widened PUT) ──────────────────────────────────────

export type { Feed }

export interface PreferencesPayload {
  preferences: SyncedPreferences
}

export interface UpdatePreferencesBody {
  blockedCategories?: AdCategory[]
  maxPerHour?: number
  maxPerDay?: number
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  tzOffsetMinutes?: number
  idleSensitivityMs?: number
  sessionWarmupMs?: number
  nightMode?: boolean
  channelMode?: ChannelMode
  newsTopics?: NewsTopic[]
  enabledFeeds?: Feed[]
}

export async function getPreferences(): Promise<SyncedPreferences> {
  const res = await apiFetch<PreferencesPayload>("/me/preferences")
  return res.preferences
}

export async function putPreferences(body: UpdatePreferencesBody): Promise<SyncedPreferences> {
  const res = await apiFetch<PreferencesPayload>("/me/preferences", {
    method: "PUT",
    body: JSON.stringify(body),
  })
  return res.preferences
}

// ── reading list ────────────────────────────────────────────────────────────

export interface ReadingItem {
  id: string
  newsId: string
  source: string
  headline: string
  url: string
  score: number
  savedAt: string // ISO 8601 from server
}

export interface ReadingListResponse {
  items: ReadingItem[]
  hasMore: boolean
}

export async function getReadingItems(limit = 100): Promise<ReadingListResponse> {
  return apiFetch<ReadingListResponse>(`/me/reading?limit=${limit}`)
}

export async function deleteReadingItem(id: string): Promise<void> {
  await apiFetch(`/me/reading/${id}`, { method: "DELETE" })
}

// ── news stats ──────────────────────────────────────────────────────────────

export interface NewsStats {
  thisWeek: number
  lastWeek: number
}

export async function getNewsStats(): Promise<NewsStats> {
  return apiFetch<NewsStats>("/me/news-stats")
}
