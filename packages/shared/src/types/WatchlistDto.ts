export type AssetClass = "equity" | "crypto"

export interface WatchlistTickerDto {
  symbol: string
  assetClass: AssetClass
  priority: number
  addedAt: string
}

export interface WatchlistDto {
  id: string
  name: string
  priority: number
  tickers: WatchlistTickerDto[]
  createdAt: string
  updatedAt: string
}
