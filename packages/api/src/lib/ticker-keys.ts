export const tickerPriceKey = (symbol: string): string => `ticker:price:${symbol}`
export const tickerSparklineKey = (symbol: string): string => `ticker:sparkline:${symbol}`
export const tickerFetcherLockKey = (bucket: string): string => `ticker:fetcher:lock:${bucket}`
