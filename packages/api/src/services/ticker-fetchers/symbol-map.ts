import { getDb } from "../../db/index.js"
import { tickerSymbolMap } from "../../db/schema/ticker_symbol_map.js"

interface CachedRow {
  assetClass: "equity" | "crypto"
  provider: "finnhub" | "coingecko"
  providerId: string
  enabled: boolean
}

interface CachedMap {
  fetchedAt: number
  byCoingecko: Record<string, string>
  bySymbol: Map<string, CachedRow>
}

const CACHE_TTL_MS = 60 * 1000
let _cache: CachedMap | null = null

async function load(): Promise<CachedMap> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache
  const db = getDb()
  const rows = await db.select().from(tickerSymbolMap)
  const byCoingecko: Record<string, string> = {}
  const bySymbol = new Map<string, CachedRow>()
  for (const r of rows) {
    bySymbol.set(r.symbol, {
      assetClass: r.assetClass as "equity" | "crypto",
      provider: r.provider as "finnhub" | "coingecko",
      providerId: r.providerId,
      enabled: r.enabled,
    })
    if (r.provider === "coingecko") byCoingecko[r.symbol] = r.providerId
  }
  _cache = { fetchedAt: Date.now(), byCoingecko, bySymbol }
  return _cache
}

// invalidates the in-process cache. Called by admin write paths.
export function invalidateSymbolMapCache(): void {
  _cache = null
}

export async function coingeckoIdFor(symbol: string): Promise<string | null> {
  const map = await load()
  return map.byCoingecko[symbol.toUpperCase()] ?? null
}

export async function isSymbolEnabled(symbol: string): Promise<boolean> {
  const map = await load()
  const row = map.bySymbol.get(symbol.toUpperCase())
  return row?.enabled ?? false
}
