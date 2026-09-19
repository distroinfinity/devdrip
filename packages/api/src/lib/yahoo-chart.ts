import { getRedis } from "./redis.js"
import { logger } from "./logger.js"

// On-demand snapshot fetcher. Per the product posture (spec §12), we don't
// persist market data — we cache upstream fetches in Redis briefly (~5 min)
// to avoid hammering Yahoo, then let TTL expire.
//
// Yahoo's public chart endpoint returns BOTH the current quote (regularMarketPrice,
// previousClose) AND the historical OHLC series in a single call — exactly
// what `buildTickerPayload` needs to produce a TickerPayload with no DB writes.

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
const SNAPSHOT_TTL_SEC = 300 // 5 minutes
const FETCH_TIMEOUT_MS = 5_000
const UA = "Mozilla/5.0 (DistroTV/0.1)"

interface YfChartResponse {
  chart: {
    result?: Array<{
      meta?: {
        symbol?: string
        currency?: string
        regularMarketPrice?: number
        previousClose?: number
        chartPreviousClose?: number
        fiftyTwoWeekHigh?: number
        fiftyTwoWeekLow?: number
        regularMarketDayHigh?: number
        regularMarketDayLow?: number
        longName?: string
        shortName?: string
      }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>
          high?: Array<number | null>
          low?: Array<number | null>
          close?: Array<number | null>
          volume?: Array<number | null>
        }>
      }
    }>
    error?: { code?: string; description?: string } | null
  }
}

export interface OhlcvCandle {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export interface TickerSnapshot {
  price: number
  // Yesterday's close — taken as the penultimate candle in the 1-month
  // sparkline. Yahoo's chart-endpoint meta does NOT include previousClose
  // (only chartPreviousClose, which is the close from the start of the
  // chart window = ~1 month ago — using that would make changePct read
  // as a 1-month delta, not a daily one).
  prevClose: number
  // (price - prevClose) / prevClose * 100 — the daily change %, matching
  // what yahoo.com shows in its quote header.
  changePct: number
  // Year-range high/low from Yahoo's quote meta. Used for the "52w X — Y"
  // stats line; never computed locally from the 1mo sparkline.
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  // Company / instrument display name (Yahoo's longName, falling back to
  // shortName). Null when Yahoo doesn't ship one.
  displayName: string | null
  sparkline: number[] // ~22 daily closes, oldest → newest
  asOfMs: number
}

// Maps our internal symbol (TSLA, BTC, ETH) to Yahoo's symbol convention.
// Crypto requires the "-USD" suffix; equities use the bare ticker.
function yahooSymbol(symbol: string, assetClass: "equity" | "crypto"): string {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "")
  if (assetClass === "crypto") return `${clean}-USD`
  return clean
}

function cacheKey(symbol: string): string {
  return `yf:snap:${symbol.toUpperCase()}`
}

// Returns the full snapshot for a single ticker. Null on any upstream
// failure — callers should skip the slot rather than render stale data.
export async function fetchTickerSnapshot(
  symbol: string,
  assetClass: "equity" | "crypto"
): Promise<TickerSnapshot | null> {
  const yfSym = yahooSymbol(symbol, assetClass)
  const key = cacheKey(yfSym)

  // 1. Redis cache lookup
  try {
    const redis = getRedis()
    const cached = await redis.get<TickerSnapshot>(key)
    if (cached && Array.isArray(cached.sparkline) && cached.sparkline.length >= 2) {
      return cached
    }
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym }, "yf cache read failed")
  }

  // 2. Fetch from Yahoo — 1 month of daily candles + quote in one call.
  const url = `${YF_BASE}/${encodeURIComponent(yfSym)}?interval=1d&range=1mo`
  let json: YfChartResponse
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) {
      logger.warn({ symbol: yfSym, status: res.status }, "yf fetch non-2xx")
      return null
    }
    json = (await res.json()) as YfChartResponse
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym }, "yf fetch failed")
    return null
  }

  const result = json?.chart?.result?.[0]
  if (!result) return null

  const meta = result.meta ?? {}
  const price = meta.regularMarketPrice
  if (typeof price !== "number") return null

  const closes = result.indicators?.quote?.[0]?.close
  if (!Array.isArray(closes)) return null
  const cleaned = closes.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  if (cleaned.length < 2) return null

  // Previous close = penultimate candle (yesterday's close). The chart
  // endpoint's meta.previousClose is undefined for daily intervals; using
  // chartPreviousClose would be the close from the start of the window
  // (1 month back). Pulling from the sparkline is the only correct path.
  const prevClose = cleaned[cleaned.length - 2] as number
  const changePct = ((price - prevClose) / prevClose) * 100

  // 52-week high/low straight from Yahoo's meta. Falls back to the
  // sparkline window only when Yahoo omits it (rare, newly listed tickers).
  const fiftyTwoWeekHigh =
    typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : Math.max(...cleaned, price)
  const fiftyTwoWeekLow =
    typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : Math.min(...cleaned, price)

  const displayName =
    typeof meta.longName === "string" && meta.longName.length > 0
      ? meta.longName
      : typeof meta.shortName === "string" && meta.shortName.length > 0
        ? meta.shortName
        : null

  const snapshot: TickerSnapshot = {
    price,
    prevClose,
    changePct: Number.isFinite(changePct) ? changePct : 0,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    displayName,
    sparkline: cleaned,
    asOfMs: Date.now(),
  }

  // 3. Cache write (best-effort).
  try {
    const redis = getRedis()
    await redis.set(key, snapshot, { ex: SNAPSHOT_TTL_SEC })
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym }, "yf cache write failed")
  }

  return snapshot
}

// Maps our internal range strings to Yahoo's range parameter.
const RANGE_TO_YF: Record<string, string> = {
  "1d": "1d",
  "1w": "5d",
  "1m": "1mo",
  "3m": "3mo",
  "1y": "1y",
}

// Returns OHLCV candles for the requested range. Used by the dashboard
// chart endpoint. Cached separately from the snapshot key so the request
// path (5-min TTL) and the deeper history (also 5-min) don't collide.
export async function fetchYahooCandles(
  symbol: string,
  assetClass: "equity" | "crypto",
  range: "1d" | "1w" | "1m" | "3m" | "1y"
): Promise<OhlcvCandle[] | null> {
  const yfSym = yahooSymbol(symbol, assetClass)
  const yfRange = RANGE_TO_YF[range] ?? "1mo"
  const key = `yf:candles:${yfSym}:${yfRange}`

  try {
    const redis = getRedis()
    const cached = await redis.get<OhlcvCandle[]>(key)
    if (Array.isArray(cached) && cached.length > 0) {
      // Redis JSON-decodes Date strings as strings; re-hydrate to Date.
      return cached.map((c) => ({ ...c, date: new Date(c.date) }))
    }
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym }, "yf candles cache read failed")
  }

  const interval = yfRange === "1d" ? "5m" : "1d"
  const url = `${YF_BASE}/${encodeURIComponent(yfSym)}?interval=${interval}&range=${yfRange}`
  let json: YfChartResponse
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    json = (await res.json()) as YfChartResponse
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym, range }, "yf candles fetch failed")
    return null
  }

  const result = json?.chart?.result?.[0]
  if (!result || !Array.isArray(result.timestamp)) return null
  const q = result.indicators?.quote?.[0]
  if (!q) return null

  const out: OhlcvCandle[] = []
  for (let i = 0; i < result.timestamp.length; i++) {
    const ts = result.timestamp[i]
    const o = q.open?.[i]
    const h = q.high?.[i]
    const l = q.low?.[i]
    const c = q.close?.[i]
    if (
      typeof ts !== "number" ||
      typeof o !== "number" ||
      typeof h !== "number" ||
      typeof l !== "number" ||
      typeof c !== "number"
    )
      continue
    out.push({
      date: new Date(ts * 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: typeof q.volume?.[i] === "number" ? (q.volume[i] as number) : null,
    })
  }
  if (out.length === 0) return null

  try {
    const redis = getRedis()
    await redis.set(key, out, { ex: SNAPSHOT_TTL_SEC })
  } catch (err) {
    logger.warn({ err: String(err), symbol: yfSym }, "yf candles cache write failed")
  }

  return out
}
