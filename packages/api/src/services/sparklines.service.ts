import { eq, gte, and, inArray, asc } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { tickerHistory } from "../db/schema/ticker_history.js"
import { watchlists } from "../db/schema/watchlists.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"
import type { SparklineDto } from "@distrotv/shared"

export async function getSparklines(userId: string, windowSec: number): Promise<SparklineDto[]> {
  const db = getDb()
  // ticker_history uses a `date` column (YYYY-MM-DD string) not a timestamp.
  // convert window to a date string for comparison.
  const sinceDate = new Date(Date.now() - windowSec * 1000).toISOString().slice(0, 10)

  const userTickers = await db
    .select({ symbol: watchlistTickers.symbol })
    .from(watchlistTickers)
    .innerJoin(watchlists, eq(watchlists.id, watchlistTickers.watchlistId))
    .where(eq(watchlists.userId, userId))

  if (userTickers.length === 0) return []
  const symbols = userTickers.map((t) => t.symbol)

  const points = await db
    .select({ symbol: tickerHistory.symbol, date: tickerHistory.date, close: tickerHistory.close })
    .from(tickerHistory)
    .where(and(inArray(tickerHistory.symbol, symbols), gte(tickerHistory.date, sinceDate)))
    .orderBy(asc(tickerHistory.symbol), asc(tickerHistory.date))

  const bySymbol = new Map<string, { ts: string; price: number }[]>()
  for (const p of points) {
    const arr = bySymbol.get(p.symbol) ?? []
    // date column is a YYYY-MM-DD string; emit as ISO 8601 noon UTC for charting
    arr.push({ ts: `${p.date}T12:00:00.000Z`, price: p.close })
    bySymbol.set(p.symbol, arr)
  }
  return Array.from(bySymbol.entries()).map(([symbol, pts]) => ({ symbol, points: pts }))
}
