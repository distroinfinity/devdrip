import type { WatchlistDto, AssetClass } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export interface WatchlistReplacement {
  name: string
  tickers: { symbol: string; assetClass: AssetClass }[]
}

export async function getMyWatchlists(): Promise<WatchlistDto[]> {
  const resp = await apiFetch<{ watchlists: WatchlistDto[] }>("/me/watchlists")
  return resp.watchlists
}

export async function putMyWatchlists(
  replacement: WatchlistReplacement[]
): Promise<WatchlistDto[]> {
  const resp = await apiFetch<{ watchlists: WatchlistDto[] }>("/me/watchlists", {
    method: "PUT",
    body: { watchlists: replacement },
  })
  return resp.watchlists
}
