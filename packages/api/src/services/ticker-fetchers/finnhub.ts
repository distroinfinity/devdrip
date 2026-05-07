import { env } from "../../config/env.js"
import type { RawCandle, RawTickerQuote } from "./types.js"

const QUOTE_URL = (symbol: string, key: string) =>
  `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`

const CANDLE_URL = (symbol: string, resolution: string, from: number, to: number, key: string) =>
  `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`

interface FinnhubQuoteResponse {
  c: number
  d: number
  dp: number
  h: number
  l: number
  o: number
  pc: number
  t: number
}

interface FinnhubCandleResponse {
  s: string
  c?: number[]
  h?: number[]
  l?: number[]
  o?: number[]
  v?: number[]
  t?: number[]
}

function syntheticQuote(symbol: string): RawTickerQuote {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const price = 100 + (seed % 200) + Math.random() * 5
  const prevClose = price * (0.97 + Math.random() * 0.06)
  return {
    symbol,
    assetClass: "equity",
    price: round2(price),
    changePct: round2(((price - prevClose) / prevClose) * 100),
    prevClose: round2(prevClose),
    asOf: new Date(),
    provider: "finnhub",
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchFinnhubQuote(symbol: string): Promise<RawTickerQuote> {
  const key = env.finnhubApiKey
  if (key === "dev_placeholder") return syntheticQuote(symbol)

  const res = await fetch(QUOTE_URL(symbol, key), { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`finnhub quote ${symbol} ${res.status}`)
  const j = (await res.json()) as FinnhubQuoteResponse
  if (typeof j.c !== "number" || typeof j.pc !== "number") {
    throw new Error(`finnhub quote ${symbol} malformed response`)
  }
  return {
    symbol,
    assetClass: "equity",
    price: j.c,
    changePct: typeof j.dp === "number" ? j.dp : 0,
    prevClose: j.pc,
    asOf: new Date((j.t ?? Math.floor(Date.now() / 1000)) * 1000),
    provider: "finnhub",
  }
}

const RESOLUTION_AND_FROM: Record<string, { resolution: string; spanSec: number }> = {
  "1d": { resolution: "5", spanSec: 86_400 },
  "1w": { resolution: "60", spanSec: 7 * 86_400 },
  "1m": { resolution: "D", spanSec: 30 * 86_400 },
  "3m": { resolution: "D", spanSec: 90 * 86_400 },
  "1y": { resolution: "D", spanSec: 365 * 86_400 },
}

export async function fetchFinnhubCandles(
  symbol: string,
  range: keyof typeof RESOLUTION_AND_FROM
): Promise<RawCandle[]> {
  const key = env.finnhubApiKey
  if (key === "dev_placeholder") return syntheticCandles(symbol, range)

  const cfg = RESOLUTION_AND_FROM[range]
  if (!cfg) throw new Error(`unknown range: ${range}`)
  const to = Math.floor(Date.now() / 1000)
  const from = to - cfg.spanSec
  const res = await fetch(CANDLE_URL(symbol, cfg.resolution, from, to, key), {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`finnhub candle ${symbol} ${res.status}`)
  const j = (await res.json()) as FinnhubCandleResponse
  if (j.s !== "ok" || !j.t || !j.c || !j.o || !j.h || !j.l) return []
  const out: RawCandle[] = []
  for (let i = 0; i < j.t.length; i++) {
    const t = j.t[i]
    const c = j.c[i]
    const o = j.o[i]
    const h = j.h[i]
    const l = j.l[i]
    if (t === undefined || c === undefined || o === undefined || h === undefined || l === undefined)
      continue
    out.push({
      date: new Date(t * 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: j.v?.[i] ?? null,
    })
  }
  return out
}

function syntheticCandles(symbol: string, range: string): RawCandle[] {
  const cfg = RESOLUTION_AND_FROM[range]
  if (!cfg) return []
  const points =
    range === "1d" ? 78 : range === "1w" ? 168 : range === "1m" ? 30 : range === "3m" ? 90 : 365
  const now = Date.now()
  const stepMs = (cfg.spanSec * 1000) / points
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const out: RawCandle[] = []
  let last = 100 + (seed % 200)
  for (let i = 0; i < points; i++) {
    const open = last
    const close = open * (0.99 + Math.random() * 0.02)
    out.push({
      date: new Date(now - (points - i) * stepMs),
      open: round2(open),
      high: round2(Math.max(open, close) * 1.005),
      low: round2(Math.min(open, close) * 0.995),
      close: round2(close),
      volume: null,
    })
    last = close
  }
  return out
}
