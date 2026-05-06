"use server"

import { redirect } from "next/navigation"
import { apiFetchOrRefresh, ApiError, UnauthenticatedError } from "@/lib/api"
import type { ChannelKey } from "@distrotv/shared"

export async function saveChannelsFromSetup(
  keys: ChannelKey[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetchOrRefresh("/me/channels", "/setup/channels", {
      method: "PUT",
      body: JSON.stringify({ channels: keys }),
      headers: { "Content-Type": "application/json" },
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      // session expired between page load and submit — bounce back to /setup to re-pair
      redirect("/setup")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : "save_failed" }
  }
}
