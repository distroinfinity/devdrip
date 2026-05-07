import { coingeckoIdFor } from "./symbol-map.js"
import type { RawCandle, RawTickerQuote } from "./types.js"

const SIMPLE_PRICE_URL = (ids: string[]) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`

const MARKET_CHART_URL = (id: string, days: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`

interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    usd: number
    usd_24h_change: number
    last_updated_at: number
  }
}

interface CoinGeckoMarketChartResponse {
  prices: [number, number][]
}

export async function fetchCoinGeckoPrices(symbols: string[]): Promise<RawTickerQuote[]> {
  if (symbols.length === 0) return []
  const idsBySym = new Map<string, string>()
  for (const s of symbols) {
    const id = coingeckoIdFor(s)
    if (id) idsBySym.set(s, id)
  }
  if (idsBySym.size === 0) return []

  const res = await fetch(SIMPLE_PRICE_URL(Array.from(idsBySym.values())), {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "DistroTV/1.0" },
  })
  if (!res.ok) throw new Error(`coingecko simple/price ${res.status}`)
  const body = (await res.json()) as CoinGeckoSimplePriceResponse

  const out: RawTickerQuote[] = []
  for (const [sym, id] of idsBySym) {
    const row = body[id]
    if (!row || typeof row.usd !== "number") continue
    const changePct = typeof row.usd_24h_change === "number" ? row.usd_24h_change : 0
    const price = row.usd
    // coingecko's simple/price has no prev_close — back-calculate from 24h change.
    // floating-point imprecision is acceptable; selection only uses prev_close to derive d1Pct,
    // which we already get directly from changePct.
    const prevClose = price / (1 + changePct / 100)
    out.push({
      symbol: sym,
      assetClass: "crypto",
      price,
      changePct,
      prevClose,
      asOf: new Date((row.last_updated_at ?? Math.floor(Date.now() / 1000)) * 1000),
      provider: "coingecko",
    })
  }
  return out
}

const DAYS_BY_RANGE: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
}

export async function fetchCoinGeckoCandles(
  symbol: string,
  range: keyof typeof DAYS_BY_RANGE
): Promise<RawCandle[]> {
  const id = coingeckoIdFor(symbol)
  if (!id) return []
  const days = DAYS_BY_RANGE[range]
  if (!days) return []
  const res = await fetch(MARKET_CHART_URL(id, days), {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "DistroTV/1.0" },
  })
  if (!res.ok) throw new Error(`coingecko market_chart ${symbol} ${res.status}`)
  const body = (await res.json()) as CoinGeckoMarketChartResponse
  return body.prices.map(([ts, price]) => ({
    date: new Date(ts),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: null,
  }))
}
