import type { NewsItem, TickerItem } from "@/components/landing/terminal-tv"

// live data for the hero broadcast panel. fetched server-side with ISR so the
// landing shows real prices/headlines without a client round-trip. every fetch
// degrades to a static fallback so a flaky upstream never breaks the page.

const SYMBOLS: { yahoo: string; label: string }[] = [
  { yahoo: "NVDA", label: "NVDA" },
  { yahoo: "AAPL", label: "AAPL" },
  { yahoo: "BTC-USD", label: "BTC" },
  { yahoo: "TSLA", label: "TSLA" },
]

const FALLBACK_MARKET: TickerItem[] = [
  { symbol: "NVDA", price: "—", delta: "0.00%", direction: "up", sparkline: "▁▂▃▅▇█▇" },
  { symbol: "AAPL", price: "—", delta: "0.00%", direction: "up", sparkline: "▁▂▂▃▃▃▃" },
  { symbol: "BTC", price: "—", delta: "0.00%", direction: "up", sparkline: "▁▂▄▃▅▆▇" },
  { symbol: "TSLA", price: "—", delta: "0.00%", direction: "down", sparkline: "▇▆▅▄▃▂▁" },
]

const FALLBACK_NEWS: NewsItem[] = [
  {
    source: "HN",
    headline: "Show HN: a terminal-native ambient feed for AI idle time",
    meta: "live",
  },
  { source: "HN", headline: "The tools that run while you think", meta: "live" },
]

const BLOCKS = "▁▂▃▄▅▆▇█"

function sparkline(values: number[]): string {
  const pts = values.filter((v) => typeof v === "number" && Number.isFinite(v))
  if (pts.length < 2) return "▁▂▃▅▇█▇"
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const target = 7
  const stride = Math.max(1, Math.floor(pts.length / target))
  const sampled: number[] = []
  for (let i = 0; i < pts.length && sampled.length < target; i += stride) sampled.push(pts[i])
  return sampled
    .map(
      (v) =>
        BLOCKS[Math.min(BLOCKS.length - 1, Math.round(((v - min) / span) * (BLOCKS.length - 1)))]
    )
    .join("")
}

function formatPrice(yahoo: string, n: number): string {
  if (yahoo === "BTC-USD") return Math.round(n).toLocaleString("en-US")
  return n.toFixed(2)
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number }
      indicators?: { quote?: Array<{ close?: (number | null)[] }> }
    }>
  }
}

async function fetchTicker(entry: { yahoo: string; label: string }): Promise<TickerItem | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${entry.yahoo}?range=1d&interval=15m`,
      { headers: { "user-agent": "Mozilla/5.0" }, next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as YahooChart
    const result = json.chart?.result?.[0]
    const price = result?.meta?.regularMarketPrice
    if (typeof price !== "number") return null
    const prev = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose ?? price
    const changePct = prev ? ((price - prev) / prev) * 100 : 0
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => typeof c === "number"
    )
    return {
      symbol: entry.label,
      price: formatPrice(entry.yahoo, price),
      delta: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
      direction: changePct >= 0 ? "up" : "down",
      sparkline: sparkline(closes),
    }
  } catch {
    return null
  }
}

export async function getMarketRows(): Promise<TickerItem[]> {
  const rows = await Promise.all(SYMBOLS.map(fetchTicker))
  const ok = rows.filter((r): r is TickerItem => r !== null)
  return ok.length === SYMBOLS.length ? ok : FALLBACK_MARKET
}

interface HnHit {
  title?: string
  points?: number
  created_at_i?: number
}

function relTime(unixSec: number): string {
  const mins = Math.max(1, Math.round(Date.now() / 1000 / 60 - unixSec / 60))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export async function getNewsItems(): Promise<NewsItem[]> {
  try {
    const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=4", {
      next: { revalidate: 300 },
    })
    if (!res.ok) return FALLBACK_NEWS
    const json = (await res.json()) as { hits?: HnHit[] }
    const hits = (json.hits ?? []).filter((h): h is Required<HnHit> =>
      Boolean(h.title && h.created_at_i)
    )
    if (hits.length < 2) return FALLBACK_NEWS
    return hits.slice(0, 2).map((h) => ({
      source: `HN · ${h.points}`,
      headline: h.title,
      meta: relTime(h.created_at_i),
    }))
  } catch {
    return FALLBACK_NEWS
  }
}
