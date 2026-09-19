"use server"

import { redirect } from "next/navigation"
import { apiFetchOrRefresh, ApiError, UnauthenticatedError } from "@/lib/api"
import type { AssetClass } from "@distrotv/shared"

export async function saveWatchlistFromSetup(
  tickers: { symbol: string; assetClass: AssetClass }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetchOrRefresh("/me/watchlists", "/setup/watchlist", {
      method: "PUT",
      body: JSON.stringify({
        watchlists: [{ name: "Default", tickers }],
      }),
      headers: { "Content-Type": "application/json" },
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/setup")
    }
    if (err instanceof ApiError) {
      const body = err.body as { error?: string } | null
      return { ok: false, error: body?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : "save_failed" }
  }
}
