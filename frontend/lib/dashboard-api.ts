import type { AdCategory, ChannelMode, NewsTopic, SyncedPreferences } from "@distrotv/shared"
import { apiFetch } from "./api"

// ── analytics (existing /me/analytics/impressions) ──────────────────────────

export interface AnalyticsSeriesPoint {
  date: string
  impressions: number
  completed: number
  clicks: number
  earned: number
}

export interface AnalyticsTotals {
  impressions: number
  completed: number
  skipped: number
  expired: number
  interrupted: number
  clicks: number
  earned: number
  ctr: number
}

export interface AnalyticsBreakdowns {
  bySource: { source: string; impressions: number; earned: number }[]
  byCategory: { category: string; impressions: number; earned: number }[]
  byResult: { result: string; impressions: number }[]
}

export interface AnalyticsResponse {
  series: AnalyticsSeriesPoint[]
  totals: AnalyticsTotals
  breakdowns: AnalyticsBreakdowns
}

export interface AnalyticsFilters {
  from?: string
  to?: string
  source?: string
  category?: string
  result?: string
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
  const qs = buildQuery({ ...filters })
  return apiFetch<AnalyticsResponse>(`/me/analytics/impressions${qs}`)
}

// ── impressions list / detail (new /me/impressions) ─────────────────────────

export interface ImpressionListItem {
  id: string
  createdAt: string
  source: string
  surface: string
  durationMs: number
  result: string
  earnedAmount: number
  cpmRate: number
  category: string | null
  campaignName: string | null
  advertiserName: string | null
  hasClick: boolean
}

export interface ImpressionListResponse {
  items: ImpressionListItem[]
  nextCursor: string | null
}

export interface ImpressionDetail extends ImpressionListItem {
  deliveryJti: string | null
  creative: {
    headline: string
    body: string | null
    ctaText: string | null
    ctaUrl: string | null
    format: string
  } | null
  click: { createdAt: string } | null
}

export interface ListImpressionsFilters extends AnalyticsFilters {
  limit?: number
  cursor?: string
}

export async function getImpressions(
  filters: ListImpressionsFilters
): Promise<ImpressionListResponse> {
  const qs = buildQuery({ ...filters })
  return apiFetch<ImpressionListResponse>(`/me/impressions${qs}`)
}

export async function getImpression(id: string): Promise<ImpressionDetail> {
  return apiFetch<ImpressionDetail>(`/me/impressions/${id}`)
}

// ── preferences (new GET, widened PUT) ──────────────────────────────────────

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

// ── onchain lp guard ──────────────────────────────────────────────────────────

export interface OnchainPosition {
  id: string
  chainId: number
  poolId: string
  tickLower: number
  tickUpper: number
  walletAddress: string
  label: string | null
  status: string
  createdAt: string
}

export interface CreateOnchainPositionBody {
  chainId: number
  poolId: string
  tickLower: number
  tickUpper: number
  walletAddress: string
  label?: string
}

export interface PoolSnapshot {
  poolId: string
  poolLabel: string
  tick: number
  price: number
  volBps: number
  feeBps: number
  asOf: string
}

export async function getOnchainPositions(): Promise<{ positions: OnchainPosition[] }> {
  return apiFetch<{ positions: OnchainPosition[] }>("/me/onchain/positions")
}

export async function createOnchainPosition(
  body: CreateOnchainPositionBody
): Promise<OnchainPosition> {
  return apiFetch<OnchainPosition>("/me/onchain/positions", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function deleteOnchainPosition(id: string): Promise<void> {
  await apiFetch(`/me/onchain/positions/${id}`, { method: "DELETE" })
}

// public — no auth required
export async function getPoolSnapshot(poolId: string): Promise<PoolSnapshot> {
  return apiFetch<PoolSnapshot>(`/onchain/pools/${poolId}`)
}

// ── helpers ─────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    entries.push([k, String(v)])
  }
  if (entries.length === 0) return ""
  const sp = new URLSearchParams(entries)
  return `?${sp.toString()}`
}
