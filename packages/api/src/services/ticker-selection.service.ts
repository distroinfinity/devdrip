import { eq, and, gte, desc, asc } from "drizzle-orm"
import type { TickerPayload, TickerStats, PendingAlert } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { watchlists } from "../db/schema/watchlists.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"
import { tickerQuotes } from "../db/schema/ticker_quotes.js"
import { tickerHistory } from "../db/schema/ticker_history.js"
import { ensureDefaultWatchlist } from "./watchlist.service.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/alert-keys.js"

export interface NextTickerArgs {
  userId: string
  deviceId: string
  rotationIndex?: number
}

export async function nextTickerForDevice(args: NextTickerArgs): Promise<TickerPayload | null> {
  await ensureDefaultWatchlist(args.userId)

  // alert-priority bump: pop the oldest pending alert for this device.
  // if a payload comes back, the rotation path is skipped — slot is forced to the alerted symbol.
  const redis = getRedis()
  const pending = await redis.lpop<PendingAlert>(pendingAlertsKey(args.deviceId))
  if (pending) {
    return await buildTickerPayload(args.userId, pending.symbol, pending)
  }

  const db = getDb()

  // primary list = priority-0 watchlist
  const [primary] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(eq(watchlists.userId, args.userId))
    .orderBy(asc(watchlists.priority), asc(watchlists.createdAt))
    .limit(1)
  if (!primary) return null

  const tickers = await db
    .select({
      symbol: watchlistTickers.symbol,
      assetClass: watchlistTickers.assetClass,
      priority: watchlistTickers.priority,
    })
    .from(watchlistTickers)
    .where(eq(watchlistTickers.watchlistId, primary.id))
    .orderBy(asc(watchlistTickers.priority))

  if (tickers.length === 0) return null

  const idx =
    typeof args.rotationIndex === "number"
      ? args.rotationIndex % tickers.length
      : deviceRotationIndex(args.deviceId, tickers.length)
  const pick = tickers[idx]
  if (!pick) return null

  return await buildTickerPayload(args.userId, pick.symbol)
}

async function buildTickerPayload(
  userId: string,
  symbol: string,
  alert?: PendingAlert
): Promise<TickerPayload | null> {
  const db = getDb()
  const [quote] = await db
    .select()
    .from(tickerQuotes)
    .where(eq(tickerQuotes.symbol, symbol))
    .limit(1)
  if (!quote) return null

  // determine asset_class — preferred from the user's watchlist row; falls back to the quote.
  // (named wlPick to avoid shadowing the rotation `pick` var in nextTickerForDevice.)
  const [wlPick] = await db
    .select({ assetClass: watchlistTickers.assetClass })
    .from(watchlistTickers)
    .innerJoin(watchlists, eq(watchlists.id, watchlistTickers.watchlistId))
    .where(and(eq(watchlists.userId, userId), eq(watchlistTickers.symbol, symbol)))
    .limit(1)
  const assetClass: "equity" | "crypto" =
    wlPick?.assetClass === "crypto"
      ? "crypto"
      : wlPick?.assetClass === "equity"
        ? "equity"
        : quote.assetClass === "crypto"
          ? "crypto"
          : "equity"

  const cutoffDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10)
  const candles = await db
    .select({ close: tickerHistory.close })
    .from(tickerHistory)
    .where(and(eq(tickerHistory.symbol, symbol), gte(tickerHistory.date, cutoffDate)))
    .orderBy(desc(tickerHistory.date))
    .limit(14)

  const sparklinePts =
    candles.length > 0 ? candles.map((c) => c.close).reverse() : [quote.prevClose, quote.price]
  const stats = computeStats(quote.price, quote.prevClose, sparklinePts)

  return {
    kind: "ticker",
    symbol: quote.symbol,
    assetClass,
    name: null,
    price: quote.price,
    changePct: quote.changePct,
    sparkline: sparklinePts,
    stats,
    layout: "single",
    stale: quote.stale,
    asOf: quote.fetchedAt.toISOString(),
    ...(alert ? { alert } : {}),
  }
}

// stable per-device rotation that steps over time. minute bucket avoids
// requiring server-side rotation state. M5 alerts override this.
function deviceRotationIndex(deviceId: string, mod: number): number {
  let h = 0
  for (let i = 0; i < deviceId.length; i++) h = (h * 31 + deviceId.charCodeAt(i)) | 0
  const minuteBucket = Math.floor(Date.now() / 60_000)
  return Math.abs(h + minuteBucket) % mod
}

function computeStats(price: number, prevClose: number, sparkline: number[]): TickerStats {
  const safePrev = Math.max(prevClose, 0.01)
  const d1 = ((price - prevClose) / safePrev) * 100
  const w1 = pctChange(sparkline, 7)
  const m1 = pctChange(sparkline, 30)
  const hi = sparkline.length > 0 ? Math.max(...sparkline, price) : price
  const lo = sparkline.length > 0 ? Math.min(...sparkline, price) : price
  return {
    d1Pct: round1(d1),
    w1Pct: round1(w1),
    m1Pct: round1(m1),
    w52Hi: round1(hi),
    w52Lo: round1(lo),
    prevClose,
  }
}

function pctChange(series: number[], n: number): number {
  if (series.length < 2) return 0
  const last = series[series.length - 1]
  const prev = series[Math.max(0, series.length - 1 - n)]
  if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return 0
  return ((last - prev) / prev) * 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
