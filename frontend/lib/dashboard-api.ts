import type { ChannelMode, NewsTopic, SyncedPreferences } from "@distrotv/shared"
import { apiFetch } from "./api"

// ── preferences (GET + widened PUT) ─────────────────────────────────────────

export interface PreferencesPayload {
  preferences: SyncedPreferences
}

export interface UpdatePreferencesBody {
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  tzOffsetMinutes?: number
  idleSensitivityMs?: number
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
