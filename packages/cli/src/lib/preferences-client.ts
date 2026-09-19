import type { AdCategory, SyncedPreferences } from "@devdrip/shared"
import { apiFetch } from "./api-client.js"

export interface PreferencesResponse {
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
}

export async function getPreferences(): Promise<SyncedPreferences> {
  const res = await apiFetch<PreferencesResponse>("/me/preferences", { method: "GET" })
  return res.preferences
}

export async function putPreferences(body: UpdatePreferencesBody): Promise<SyncedPreferences> {
  const res = await apiFetch<PreferencesResponse>("/me/preferences", {
    method: "PUT",
    body,
  })
  return res.preferences
}
