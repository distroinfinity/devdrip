// CoinGecko uses provider ids ('bitcoin', 'ethereum'), not the user-facing symbol.
// Hard-coded for the seed v1; admin-managed table follows in M7.
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
}

export function coingeckoIdFor(symbol: string): string | null {
  return COINGECKO_IDS[symbol.toUpperCase()] ?? null
}
