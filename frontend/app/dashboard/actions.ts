"use server"

import { redirect } from "next/navigation"
import type { ChannelMode } from "@distrotv/shared"
import { putPreferences, deleteReadingItem as apiDeleteReadingItem } from "@/lib/dashboard-api"
import { ApiError, UnauthenticatedError } from "@/lib/api"

export interface UpdateModeResult {
  ok: boolean
  error?: string
}

// dashboard mode-toggle pill calls this after optimistic UI update
export async function updateChannelMode(mode: ChannelMode): Promise<UpdateModeResult> {
  try {
    await putPreferences({ channelMode: mode })
    return { ok: true }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: "network_error" }
  }
}

export interface DeleteReadingResult {
  ok: boolean
  error?: string
}

// /dashboard/reading row remove button calls this after optimistic remove
export async function deleteReadingItem(id: string): Promise<DeleteReadingResult> {
  try {
    await apiDeleteReadingItem(id)
    return { ok: true }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/reading")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: "network_error" }
  }
}
