import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"
import type { AssetClass } from "@distrotv/shared"
import { WATCHLIST_MAX, TICKERS_PER_WATCHLIST_MAX } from "../services/watchlist.service.js"

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/
const ASSET_CLASSES: AssetClass[] = ["equity", "crypto"]

export interface PutWatchlistsInput {
  watchlists: {
    name: string
    tickers: { symbol: string; assetClass: AssetClass }[]
  }[]
}

export function validatePutWatchlists(body: unknown): PutWatchlistsInput {
  const b = requireBody(body)
  const arr = b["watchlists"]
  if (!Array.isArray(arr)) throw new ValidationError("invalid_watchlists")
  if (arr.length === 0) throw new ValidationError("at_least_one_watchlist_required")
  if (arr.length > WATCHLIST_MAX) throw new ValidationError("too_many_watchlists")

  const out: PutWatchlistsInput["watchlists"] = []
  const seenNames = new Set<string>()
  for (const item of arr) {
    if (typeof item !== "object" || item === null) throw new ValidationError("invalid_watchlist")
    const o = item as Record<string, unknown>
    const name = o["name"]
    if (typeof name !== "string" || name.length === 0 || name.length > 32) {
      throw new ValidationError("invalid_watchlist_name")
    }
    if (seenNames.has(name)) throw new ValidationError("duplicate_watchlist_name")
    seenNames.add(name)

    const tickersRaw = o["tickers"]
    if (!Array.isArray(tickersRaw)) throw new ValidationError("invalid_tickers")
    if (tickersRaw.length === 0) throw new ValidationError("at_least_one_ticker_required")
    if (tickersRaw.length > TICKERS_PER_WATCHLIST_MAX) {
      throw new ValidationError("too_many_tickers")
    }

    const tickers: { symbol: string; assetClass: AssetClass }[] = []
    const seenSymbols = new Set<string>()
    for (const tRaw of tickersRaw) {
      if (typeof tRaw !== "object" || tRaw === null) throw new ValidationError("invalid_ticker")
      const t = tRaw as Record<string, unknown>
      const sym = t["symbol"]
      if (typeof sym !== "string") throw new ValidationError("invalid_symbol")
      const upper = sym.toUpperCase()
      if (!SYMBOL_RE.test(upper)) throw new ValidationError("invalid_symbol")
      if (seenSymbols.has(upper)) throw new ValidationError("duplicate_symbol")
      seenSymbols.add(upper)
      const ac = t["assetClass"]
      if (typeof ac !== "string" || !ASSET_CLASSES.includes(ac as AssetClass)) {
        throw new ValidationError("invalid_asset_class")
      }
      tickers.push({ symbol: upper, assetClass: ac as AssetClass })
    }

    out.push({ name, tickers })
  }
  return { watchlists: out }
}
