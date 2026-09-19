"use server"

import { redirect } from "next/navigation"
import { putPreferences, type UpdatePreferencesBody } from "@/lib/dashboard-api"
import { ApiError, UnauthenticatedError } from "@/lib/api"
import type { SyncedPreferences } from "@distrotv/shared"

export interface SaveResult {
  ok: boolean
  preferences?: SyncedPreferences
  error?: string
}

export async function savePreferences(body: UpdatePreferencesBody): Promise<SaveResult> {
  try {
    const updated = await putPreferences(body)
    return { ok: true, preferences: updated }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/preferences")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: "network_error" }
  }
}
