"use server"

import { redirect } from "next/navigation"
import { apiFetchOrRefresh, ApiError, UnauthenticatedError } from "@/lib/api"
import type { WatchlistDto, AssetClass } from "@distrotv/shared"

export interface SaveWatchlistsResult {
  ok: boolean
  watchlists?: WatchlistDto[]
  error?: string
}

export async function saveWatchlists(
  replacement: { name: string; tickers: { symbol: string; assetClass: AssetClass }[] }[]
): Promise<SaveWatchlistsResult> {
  try {
    const data = await apiFetchOrRefresh<{ watchlists: WatchlistDto[] }>(
      "/me/watchlists",
      "/dashboard/watchlists",
      {
        method: "PUT",
        body: JSON.stringify({ watchlists: replacement }),
        headers: { "Content-Type": "application/json" },
      }
    )
    return { ok: true, watchlists: data.watchlists }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/watchlists")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : "save_failed" }
  }
}
