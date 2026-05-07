import { API_URL } from "@/lib/env"
import { ChartClient } from "./chart-client"

interface PageProps {
  params: Promise<{ symbol: string }>
  searchParams: Promise<{ range?: string }>
}

interface CandlesResponse {
  symbol: string
  assetClass: "equity" | "crypto"
  range: string
  candles: { date: string; open: number; high: number; low: number; close: number }[]
}

// public page — uses plain fetch (no auth-aware redirect on 401) so logged-out
// visitors can land on a chart url. /tickers is a public api route by design.
export default async function ChartPage({ params, searchParams }: PageProps) {
  const { symbol: rawSymbol } = await params
  const { range: rawRange } = await searchParams
  const symbol = rawSymbol.toUpperCase()
  const range = (rawRange ?? "1m") as "1d" | "1w" | "1m" | "3m" | "1y"

  const upstream = await fetch(
    `${API_URL}/tickers/${encodeURIComponent(symbol)}/history?range=${range}`,
    { cache: "no-store" }
  )
  if (!upstream.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-[24px] font-bold">{symbol}</h1>
          <p className="text-sm text-[var(--ink-secondary)]">
            couldn&apos;t load chart data ({upstream.status}). try again later.
          </p>
        </div>
      </main>
    )
  }
  const data = (await upstream.json()) as CandlesResponse

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="font-display text-[32px] font-bold tracking-tight">
            {symbol}{" "}
            <span className="text-[var(--ink-tertiary)] text-[16px]">{data.assetClass}</span>
          </h1>
        </header>
        <ChartClient initial={data} />
      </div>
    </main>
  )
}
