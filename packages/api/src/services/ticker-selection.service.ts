import { eq, and, asc } from "drizzle-orm"
import type { TickerPayload, TickerStats, PendingAlert } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { watchlists } from "../db/schema/watchlists.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"
import { ensureDefaultWatchlist } from "./watchlist.service.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/alert-keys.js"
import { isInQuietHours } from "../lib/quiet-hours.js"
import { fetchTickerSnapshot } from "../lib/yahoo-chart.js"

export interface NextTickerArgs {
  userId: string
  deviceId: string
  rotationIndex?: number
}

export async function nextTickerForDevice(args: NextTickerArgs): Promise<TickerPayload | null> {
  await ensureDefaultWatchlist(args.userId)

  // alert-priority bump: pop the oldest pending alert for this device.
  // if a payload comes back, the rotation path is skipped — slot is forced to the alerted symbol.
  const db = getDb()

  const userPrefsRow = await db
    .select({
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      tzOffsetMinutes: preferences.tzOffsetMinutes,
    })
    .from(preferences)
    .where(eq(preferences.userId, args.userId))
    .limit(1)
  const userPrefs = userPrefsRow[0] ?? {
    quietHoursStart: null,
    quietHoursEnd: null,
    tzOffsetMinutes: 0,
  }

  if (!isInQuietHours(userPrefs, new Date())) {
    const redis = getRedis()
    const pending = await redis.lpop<PendingAlert>(pendingAlertsKey(args.deviceId))
    if (pending) {
      return await buildTickerPayload(args.userId, pending.symbol, pending)
    }
  }
  // fall through to regular rotation (existing code)

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

// Builds the TradingView URL for a ticker, used on [C] chart in the CLI.
// Per spec §8: equities use the bare-symbol form (TV resolves to the
// primary exchange for major tickers), crypto uses the symbol + USD pair.
// Exchange-prefixed URLs (NASDAQ-TSLA) require a per-symbol exchange map
// that we don't yet maintain — bare-symbol resolves correctly for the
// curated watchlist universe (top ~500 equities + top ~50 crypto).
function buildChartUrl(symbol: string, assetClass: "equity" | "crypto"): string {
  const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (assetClass === "crypto") {
    return `https://www.tradingview.com/symbols/${cleaned}USD/`
  }
  return `https://www.tradingview.com/symbols/${cleaned}/`
}

async function buildTickerPayload(
  userId: string,
  symbol: string,
  alert?: PendingAlert
): Promise<TickerPayload | null> {
  const db = getDb()

  // Asset class comes from the user's watchlist row (single source of truth).
  // Default to equity when there's no row — Yahoo's lookup handles the rest.
  const [wlPick] = await db
    .select({ assetClass: watchlistTickers.assetClass })
    .from(watchlistTickers)
    .innerJoin(watchlists, eq(watchlists.id, watchlistTickers.watchlistId))
    .where(and(eq(watchlists.userId, userId), eq(watchlistTickers.symbol, symbol)))
    .limit(1)
  const assetClass: "equity" | "crypto" = wlPick?.assetClass === "crypto" ? "crypto" : "equity"

  // Per spec §12: we don't persist market data. Quote + sparkline come from
  // Yahoo on demand (Redis-cached ~5 min). Null on failure so the orchestrator
  // can move on to the next slot rather than surfacing a broken tile.
  const snap = await fetchTickerSnapshot(symbol, assetClass)
  if (!snap) return null

  const stats = computeStats(snap.price, snap.prevClose, snap.sparkline)

  return {
    kind: "ticker",
    symbol,
    assetClass,
    name: null,
    price: snap.price,
    changePct: snap.changePct,
    sparkline: snap.sparkline,
    stats,
    layout: "single",
    stale: false,
    asOf: new Date(snap.asOfMs).toISOString(),
    chartUrl: buildChartUrl(symbol, assetClass),
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
