"use client"

import { useRouter } from "next/navigation"
import type { WatchlistDto, SparklineDto } from "@distrotv/shared"
import { EmptyState } from "@/components/v5/empty-state"

interface Props {
  watchlists: WatchlistDto[]
  sparklines: SparklineDto[]
}

function InlineSparkline({ points }: { points: { ts: string; price: number }[] }) {
  if (points.length < 2) {
    return (
      <svg width={50} height={14} viewBox="0 0 50 14" preserveAspectRatio="none">
        <line x1={0} y1={7} x2={50} y2={7} stroke="var(--rule-default)" strokeWidth={1} />
      </svg>
    )
  }

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 50
    const y = 14 - ((p.price - min) / range) * 12 - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const lastPrice = prices[prices.length - 1] ?? 0
  const firstPrice = prices[0] ?? 0
  const isPos = lastPrice >= firstPrice
  const stroke = isPos ? "#2F8F4E" : "#C13438"

  return (
    <svg width={50} height={14} viewBox="0 0 50 14" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} stroke={stroke} strokeWidth={1.4} fill="none" />
    </svg>
  )
}

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  if (price >= 100) return `$${price.toFixed(2)}`
  return `$${price.toFixed(2)}`
}

export function WatchlistTab({ watchlists, sparklines }: Props) {
  const router = useRouter()
  const sparkMap = new Map(sparklines.map((s) => [s.symbol, s.points]))

  const tickers = watchlists.flatMap((w) => w.tickers)

  if (tickers.length === 0) {
    return (
      <EmptyState
        title="no watchlist tickers"
        body="add tickers in watchlists to track prices here."
      />
    )
  }

  return (
    <div className="pb-7">
      {/* header row */}
      <div
        className="grid gap-2 py-2 border-b border-[var(--rule-default)] font-[var(--font-data)] text-[9px] tracking-[0.06em] uppercase text-[var(--ink-tertiary)]"
        style={{ gridTemplateColumns: "50px 1fr 50px 56px 60px" }}
      >
        <span>symbol</span>
        <span>price</span>
        <span>chart</span>
        <span className="text-right">24h</span>
        <span />
      </div>

      {tickers.map((ticker) => {
        const points = sparkMap.get(ticker.symbol) ?? []
        const prices = points.map((p) => p.price)
        const lastPrice = prices[prices.length - 1]
        const firstPrice = prices[0]
        const dayPct =
          prices.length >= 2 && firstPrice && lastPrice
            ? ((lastPrice - firstPrice) / firstPrice) * 100
            : null
        const isPos = dayPct !== null && dayPct >= 0

        return (
          <div
            key={ticker.symbol}
            className="grid gap-2 py-2 border-b border-[var(--rule-2,var(--rule-default))] last:border-b-0 items-center cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
            style={{ gridTemplateColumns: "50px 1fr 50px 56px 60px" }}
            onClick={() => router.push("/dashboard/watchlists")}
          >
            <span className="font-[var(--font-display)] text-[12px] font-bold">
              {ticker.symbol}
            </span>
            <span className="font-[var(--font-data)] text-[11px] tabular-nums text-[var(--ink-secondary)]">
              {lastPrice ? formatPrice(lastPrice) : "—"}
            </span>
            <InlineSparkline points={points} />
            <span
              className="font-[var(--font-data)] text-[11px] tabular-nums text-right"
              style={{
                color: dayPct === null ? "var(--ink-tertiary)" : isPos ? "#2F8F4E" : "#C13438",
              }}
            >
              {dayPct !== null ? `${isPos ? "+" : ""}${dayPct.toFixed(2)}%` : "—"}
            </span>
            <span className="font-[var(--font-data)] text-[9px] text-[var(--ink-tertiary)] uppercase tracking-wide">
              {ticker.assetClass}
            </span>
          </div>
        )
      })}
    </div>
  )
}
