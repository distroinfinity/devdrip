import { randomUUID } from "node:crypto"
import { sql, inArray } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { tickerQuotes } from "../../db/schema/ticker_quotes.js"
import { getRedis } from "../../lib/redis.js"
import { tickerPriceKey, tickerFetcherLockKey } from "../../lib/ticker-keys.js"
import { logger } from "../../lib/logger.js"
import { distinctActiveSymbols } from "../watchlist.service.js"
import { fetchFinnhubQuote } from "./finnhub.js"
import { fetchCoinGeckoPrices } from "./coingecko.js"
import type { RawTickerQuote } from "./types.js"

const LOCK_TTL_SEC = 90
const PRICE_CACHE_TTL_SEC = 60
const FINNHUB_RATE_LIMIT_MS = 1_100
const TICK_LOCK_KEY = tickerFetcherLockKey("global-tick")

const CAS_DEL_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`

async function withLock(key: string, fn: () => Promise<void>): Promise<void> {
  const redis = getRedis()
  const token = randomUUID()
  const got = await redis.set(key, token, { nx: true, ex: LOCK_TTL_SEC })
  if (!got) return
  try {
    await fn()
  } finally {
    try {
      await redis.eval(CAS_DEL_SCRIPT, [key], [token])
    } catch (err) {
      // TestRedis (in-memory dev/test fallback) does not implement eval. Single-process
      // dev has no lock contention, so a missed cleanup just leaves a stale key that
      // expires after LOCK_TTL_SEC. Production (Upstash REST) supports eval natively.
      logger.debug({ err: String(err) }, "ticker lock cas-delete unsupported (TestRedis)")
    }
  }
}

async function upsertQuote(q: RawTickerQuote): Promise<void> {
  const db = getDb()
  await db
    .insert(tickerQuotes)
    .values({
      symbol: q.symbol,
      assetClass: q.assetClass,
      price: q.price,
      changePct: q.changePct,
      prevClose: q.prevClose,
      lastProvider: q.provider,
      fetchedAt: q.asOf,
      stale: false,
    })
    .onConflictDoUpdate({
      target: tickerQuotes.symbol,
      set: {
        price: sql`EXCLUDED.price`,
        changePct: sql`EXCLUDED.change_pct`,
        prevClose: sql`EXCLUDED.prev_close`,
        lastProvider: sql`EXCLUDED.last_provider`,
        fetchedAt: sql`EXCLUDED.fetched_at`,
        assetClass: sql`EXCLUDED.asset_class`,
        stale: false,
      },
    })
}

async function cacheQuoteRedis(q: RawTickerQuote): Promise<void> {
  const redis = getRedis()
  await redis.set(tickerPriceKey(q.symbol), q, { ex: PRICE_CACHE_TTL_SEC })
}

async function markStale(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return
  const db = getDb()
  await db.update(tickerQuotes).set({ stale: true }).where(inArray(tickerQuotes.symbol, symbols))
}

export async function runTickerTick(): Promise<void> {
  await withLock(TICK_LOCK_KEY, async () => {
    const symbols = await distinctActiveSymbols()
    if (symbols.length === 0) {
      logger.info("ticker.fetch tick: no active symbols")
      return
    }
    logger.info({ count: symbols.length }, "ticker.fetch tick")

    const equities = symbols.filter((s) => s.assetClass === "equity").map((s) => s.symbol)
    const cryptos = symbols.filter((s) => s.assetClass === "crypto").map((s) => s.symbol)

    let cryptoOk = 0
    if (cryptos.length > 0) {
      try {
        const quotes = await fetchCoinGeckoPrices(cryptos)
        for (const q of quotes) {
          await upsertQuote(q)
          await cacheQuoteRedis(q)
          cryptoOk += 1
        }
      } catch (err) {
        logger.warn({ err: String(err) }, "coingecko batch failed — marking stale")
        await markStale(cryptos)
      }
    }

    let equityOk = 0
    const equityFailed: string[] = []
    for (const sym of equities) {
      try {
        const q = await fetchFinnhubQuote(sym)
        await upsertQuote(q)
        await cacheQuoteRedis(q)
        equityOk += 1
      } catch (err) {
        logger.warn({ symbol: sym, err: String(err) }, "finnhub fetch failed")
        equityFailed.push(sym)
      }
      await new Promise((r) => setTimeout(r, FINNHUB_RATE_LIMIT_MS))
    }
    if (equityFailed.length > 0) await markStale(equityFailed)

    logger.info(
      { cryptoOk, equityOk, equityFailed: equityFailed.length },
      "ticker.fetch tick complete"
    )
  })
}
