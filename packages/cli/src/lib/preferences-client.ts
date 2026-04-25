import type { AdCategory } from "@devdrip/shared"
import { apiFetch } from "./api-client.js"

export interface PreferencesResponse {
  preferences: {
    blockedCategories: AdCategory[]
    enabledSurfaces: string[]
    maxPerHour: number
    maxPerDay: number
    quietHoursStart: number | null
    quietHoursEnd: number | null
    tzOffsetMinutes: number
    idleSensitivityMs: number
  }
}

export interface UpdatePreferencesBody {
  blockedCategories?: AdCategory[]
  tzOffsetMinutes?: number
}

export async function putPreferences(
  body: UpdatePreferencesBody
): Promise<PreferencesResponse["preferences"]> {
  const res = await apiFetch<PreferencesResponse>("/me/preferences", {
    method: "PUT",
    body,
  })
  return res.preferences
}
