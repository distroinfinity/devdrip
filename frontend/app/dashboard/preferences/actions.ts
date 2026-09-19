"use server"

import { redirect } from "next/navigation"
import { putPreferences, type UpdatePreferencesBody } from "@/lib/dashboard-api"
import { apiFetchOrRefresh, ApiError, UnauthenticatedError } from "@/lib/api"
import type { ChannelDto, ChannelKey, SyncedPreferences } from "@distrotv/shared"

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

export interface SaveChannelsResult {
  ok: boolean
  channels?: ChannelDto[]
  error?: string
}

export async function saveChannels(keys: ChannelKey[]): Promise<SaveChannelsResult> {
  try {
    const data = await apiFetchOrRefresh<{ channels: ChannelDto[] }>(
      "/me/channels",
      "/dashboard/preferences",
      {
        method: "PUT",
        body: JSON.stringify({ channels: keys }),
        headers: { "Content-Type": "application/json" },
      }
    )
    return { ok: true, channels: data.channels }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/preferences")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : "save_failed" }
  }
}
