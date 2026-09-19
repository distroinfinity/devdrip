import { ValidationError } from "../errors/index.js"

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

export interface PutWatchlistsInput {
  tickers: { symbol: string; assetClass: "equity" | "crypto" }[]
}

export function validatePutWatchlistsInput(body: unknown): PutWatchlistsInput {
  const tickers = (body as { tickers?: unknown })?.tickers
  if (!Array.isArray(tickers)) throw new ValidationError("tickers_must_be_array")
  if (tickers.length === 0) throw new ValidationError("at_least_one_ticker_required")
  if (tickers.length > 50) throw new ValidationError("too_many_tickers")
  const seen = new Set<string>()
  for (const t of tickers as { symbol: unknown; assetClass: unknown }[]) {
    if (typeof t.symbol !== "string" || !SYMBOL_RE.test(t.symbol)) {
      throw new ValidationError("invalid_symbol")
    }
    if (t.assetClass !== "equity" && t.assetClass !== "crypto") {
      throw new ValidationError("invalid_asset_class")
    }
    if (seen.has(t.symbol)) throw new ValidationError("duplicate_symbol")
    seen.add(t.symbol)
  }
  return { tickers: tickers as { symbol: string; assetClass: "equity" | "crypto" }[] }
}
