import type { AdCategory, ChannelMode, NewsTopic, SyncedPreferences } from "@devdrip/shared"
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
