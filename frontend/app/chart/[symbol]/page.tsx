import { apiFetchOrRefresh } from "@/lib/api"
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

export default async function ChartPage({ params, searchParams }: PageProps) {
  const { symbol: rawSymbol } = await params
  const { range: rawRange } = await searchParams
  const symbol = rawSymbol.toUpperCase()
  const range = (rawRange ?? "1m") as "1d" | "1w" | "1m" | "3m" | "1y"

  const data = await apiFetchOrRefresh<CandlesResponse>(
    `/tickers/${encodeURIComponent(symbol)}/history?range=${range}`,
    `/chart/${symbol}`
  )

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
