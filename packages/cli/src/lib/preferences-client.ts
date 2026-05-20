import type { ChannelMode, SyncedPreferences } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export interface PreferencesResponse {
  preferences: SyncedPreferences
}

export interface UpdatePreferencesBody {
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  tzOffsetMinutes?: number
  channelMode?: ChannelMode
  idleSensitivityMs?: number
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
