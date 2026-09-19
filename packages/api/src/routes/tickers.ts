import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"
import type { AssetClass } from "@distrotv/shared"
import { fetchFinnhubCandles } from "../services/ticker-fetchers/finnhub.js"
import { fetchCoinGeckoCandles } from "../services/ticker-fetchers/coingecko.js"

export const tickersRouter: ReturnType<typeof Router> = Router()

const RANGES = ["1d", "1w", "1m", "3m", "1y"] as const
type Range = (typeof RANGES)[number]

tickersRouter.get("/:symbol/history", async (req, res, next) => {
  try {
    const symbol = (req.params.symbol ?? "").toUpperCase()
    if (!/^[A-Z0-9.\-]{1,16}$/.test(symbol)) {
      res.status(400).json({ error: "invalid_symbol" })
      return
    }
    const rangeRaw = (req.query["range"] as string | undefined) ?? "1m"
    if (!RANGES.includes(rangeRaw as Range)) {
      res.status(400).json({ error: "invalid_range" })
      return
    }
    const range = rangeRaw as Range

    // determine asset class from any watchlist entry — first match wins.
    // unknown symbols default to equity (Finnhub).
    const db = getDb()
    const [hit] = await db
      .select({ assetClass: watchlistTickers.assetClass })
      .from(watchlistTickers)
      .where(eq(watchlistTickers.symbol, symbol))
      .limit(1)
    const assetClass: AssetClass = (hit?.assetClass as AssetClass) ?? "equity"

    const candles =
      assetClass === "crypto"
        ? await fetchCoinGeckoCandles(symbol, range)
        : await fetchFinnhubCandles(symbol, range)

    res.json({
      symbol,
      assetClass,
      range,
      candles: candles.map((c) => ({
        date: c.date.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
    })
  } catch (err) {
    next(err)
  }
})
