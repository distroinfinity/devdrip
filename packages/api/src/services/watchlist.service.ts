import { eq, asc } from "drizzle-orm"
import type { WatchlistDto, AssetClass, WatchlistTickerDto } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { watchlists } from "../db/schema/watchlists.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"

const DEFAULT_NAME = "Default"
const DEFAULT_SEED: { symbol: string; assetClass: AssetClass }[] = [
  { symbol: "AAPL", assetClass: "equity" },
  { symbol: "MSFT", assetClass: "equity" },
  { symbol: "NVDA", assetClass: "equity" },
  { symbol: "BTC", assetClass: "crypto" },
  { symbol: "ETH", assetClass: "crypto" },
]

export const WATCHLIST_MAX = 3
export const TICKERS_PER_WATCHLIST_MAX = 25

export async function ensureDefaultWatchlist(userId: string): Promise<void> {
  const db = getDb()
  // first-time only — gated on EXISTS so an explicit empty save is not silently re-seeded.
  // (mirrors the m3 ensureDefaultSubscriptions WHERE NOT EXISTS pattern.)
  const [existing] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .limit(1)
  if (existing) return

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(watchlists)
      .values({ userId, name: DEFAULT_NAME, priority: 0 })
      .returning()
    if (!created) throw new Error("ensureDefaultWatchlist: insert returned no row")
    await tx.insert(watchlistTickers).values(
      DEFAULT_SEED.map((t, i) => ({
        watchlistId: created.id,
        symbol: t.symbol,
        assetClass: t.assetClass,
        priority: i,
      }))
    )
  })
}

export async function getWatchlistsForUser(userId: string): Promise<WatchlistDto[]> {
  const db = getDb()
  await ensureDefaultWatchlist(userId)

  const lists = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .orderBy(asc(watchlists.priority), asc(watchlists.createdAt))

  if (lists.length === 0) return []

  // v1 simplification: return only the priority-0 (primary) list's tickers.
  // multi-list support is schema-only this milestone; m6 dashboard polish
  // promotes this to a full multi-list query.
  const primary = lists[0]
  if (!primary) return []
  const tickers = await db
    .select()
    .from(watchlistTickers)
    .where(eq(watchlistTickers.watchlistId, primary.id))
    .orderBy(asc(watchlistTickers.priority))

  const tickersByListId = new Map<string, WatchlistTickerDto[]>()
  for (const l of lists) tickersByListId.set(l.id, [])
  for (const t of tickers) {
    const arr = tickersByListId.get(t.watchlistId)
    if (!arr) continue
    arr.push({
      symbol: t.symbol,
      assetClass: t.assetClass as AssetClass,
      priority: t.priority,
      addedAt: t.createdAt.toISOString(),
    })
  }

  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    priority: l.priority,
    tickers: tickersByListId.get(l.id) ?? [],
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }))
}

export interface WatchlistReplacement {
  name: string
  tickers: { symbol: string; assetClass: AssetClass }[]
}

export async function setWatchlists(
  userId: string,
  replacement: WatchlistReplacement[]
): Promise<void> {
  if (replacement.length === 0) {
    throw new Error("setWatchlists: replacement must include at least one watchlist")
  }
  if (replacement.length > WATCHLIST_MAX) {
    throw new Error(`setWatchlists: max ${WATCHLIST_MAX} watchlists per user`)
  }
  for (const w of replacement) {
    if (w.tickers.length === 0) {
      throw new Error("setWatchlists: every watchlist must contain at least one ticker")
    }
    if (w.tickers.length > TICKERS_PER_WATCHLIST_MAX) {
      throw new Error(`setWatchlists: max ${TICKERS_PER_WATCHLIST_MAX} tickers per watchlist`)
    }
  }

  const db = getDb()
  return db.transaction(async (tx) => {
    // wipe and rewrite — full-replacement semantic. for ≤3 lists × ≤25 tickers
    // at 100-user scale, this is trivial and avoids the diff-merge bug surface.
    await tx.delete(watchlists).where(eq(watchlists.userId, userId))

    for (let i = 0; i < replacement.length; i++) {
      const w = replacement[i]
      if (!w) continue
      const [created] = await tx
        .insert(watchlists)
        .values({ userId, name: w.name, priority: i, updatedAt: new Date() })
        .returning()
      if (!created) throw new Error("setWatchlists: insert returned no row")

      await tx.insert(watchlistTickers).values(
        w.tickers.map((t, j) => ({
          watchlistId: created.id,
          symbol: t.symbol.toUpperCase(),
          assetClass: t.assetClass,
          priority: j,
        }))
      )
    }
  })
}

// returns DISTINCT (symbol, asset_class) across all users — input for the ticker fetcher coordinator.
export async function distinctActiveSymbols(): Promise<
  { symbol: string; assetClass: AssetClass }[]
> {
  const db = getDb()
  const rows = await db
    .selectDistinct({
      symbol: watchlistTickers.symbol,
      assetClass: watchlistTickers.assetClass,
    })
    .from(watchlistTickers)
  return rows.map((r) => ({ symbol: r.symbol, assetClass: r.assetClass as AssetClass }))
}
