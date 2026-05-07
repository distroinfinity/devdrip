import type { AssetClass } from "@distrotv/shared"

export interface RawTickerQuote {
  symbol: string
  assetClass: AssetClass
  price: number
  changePct: number
  prevClose: number
  asOf: Date
  provider: "finnhub" | "coingecko"
}

export interface RawCandle {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export interface FetchContext {
  symbol: string
  assetClass: AssetClass
}
