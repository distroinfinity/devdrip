import type { SlotLayout } from "./SlotPayload.js"
import type { AssetClass } from "./WatchlistDto.js"
import type { PendingAlert } from "./AlertDto.js"

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
  assetClass: AssetClass
  name: string | null
  price: number
  changePct: number
  sparkline: number[]
  stats: TickerStats
  layout: SlotLayout
  stale: boolean
  asOf: string
  // populated when this slot was promoted by an alert fire — daemon renders the glow variant.
  alert?: PendingAlert
}
