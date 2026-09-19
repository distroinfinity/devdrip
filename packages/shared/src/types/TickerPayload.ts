import type { SlotLayout } from "./SlotPayload.js"

export interface TickerStats {
  d1Pct: number
  w1Pct: number
  m1Pct: number
  w52Hi: number
  w52Lo: number
  prevClose: number
}

export interface TickerPayload {
  kind: "ticker"
  symbol: string
  name: string | null
  price: number
  changePct: number
  sparkline: number[] // 14-30 points, normalized
  stats: TickerStats
  layout: SlotLayout
  stale: boolean // true when served from cached Redis past freshness window
  asOf: string // ISO timestamp from upstream provider
}
