"use client"

import { useState, useTransition, useId } from "react"
import type { WatchlistDto, WatchlistTickerDto, SparklineDto, AssetClass } from "@distrotv/shared"
import { SortableList } from "@/components/dashboard/dnd/sortable-list"
import { Sparkline } from "@/components/dashboard/watchlists/sparkline"
import { EmptyState } from "@/components/v5/empty-state"
import { SectionRule } from "@/components/v5/section-rule"
import { SharpInput } from "@/components/v5/sharp-input"
import { SharpButton } from "@/components/v5/sharp-button"
import { saveWatchlists } from "./actions"

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])
const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

function inferAssetClass(s: string): AssetClass {
  return KNOWN_CRYPTO.has(s.toUpperCase()) ? "crypto" : "equity"
}

// sparklines keyed by symbol
function buildSparkMap(sparklines: SparklineDto[]): Map<string, SparklineDto> {
  const m = new Map<string, SparklineDto>()
  for (const s of sparklines) m.set(s.symbol, s)
  return m
}

interface TickerRowItem extends WatchlistTickerDto {
  id: string // required by SortableList — mirrors symbol
}

function pctColor(pct: number): string {
  if (pct > 0) return "var(--color-forest, #2F8F4E)"
  if (pct < 0) return "var(--color-oxblood, #C13438)"
  return "var(--ink-tertiary)"
}

interface Props {
  initial: WatchlistDto[]
  sparklines: SparklineDto[]
}

export function WatchlistsClient({ initial, sparklines }: Props) {
  // flat ticker list from the default watchlist (single-watchlist architecture)
  const defaultList = initial[0]
  const [tickers, setTickers] = useState<TickerRowItem[]>(
    (defaultList?.tickers ?? []).map((t) => ({ ...t, id: t.symbol }))
  )
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const inputId = useId()

  const sparkMap = buildSparkMap(sparklines)

  function persist(next: TickerRowItem[]) {
    start(async () => {
      const result = await saveWatchlists(
        next.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass }))
      )
      if (result.ok && result.watchlists) {
        const fresh = result.watchlists[0]?.tickers ?? []
        setTickers(fresh.map((t) => ({ ...t, id: t.symbol })))
        setError(null)
      } else {
        setError(result.error ?? "save failed")
      }
    })
  }

  function addTicker() {
    const raw = draft.trim().toUpperCase()
    if (!SYMBOL_RE.test(raw)) {
      setError("invalid symbol")
      return
    }
    if (tickers.some((t) => t.symbol === raw)) {
      setDraft("")
      setError(`${raw} already in list`)
      return
    }
    const next: TickerRowItem[] = [
      ...tickers,
      {
        symbol: raw,
        assetClass: inferAssetClass(raw),
        priority: tickers.length,
        addedAt: new Date().toISOString(),
        id: raw,
      },
    ]
    setDraft("")
    persist(next)
  }

  function removeTicker(symbol: string) {
    const next = tickers.filter((t) => t.symbol !== symbol)
    persist(next)
  }

  function onReorder(next: TickerRowItem[]) {
    setTickers(next)
    persist(next)
  }

  const addForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        addTicker()
      }}
      className="flex gap-2 mt-4"
    >
      <SharpInput
        id={inputId}
        type="text"
        placeholder="symbol — AAPL, BTC…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={pending}
        className="flex-1 text-[12px] font-[var(--font-data)]"
      />
      <SharpButton type="submit" disabled={pending || !draft.trim()} className="text-[12px]">
        add
      </SharpButton>
    </form>
  )

  return (
    <div>
      {error && (
        <p className="mb-3 font-[var(--font-data)] text-[11px] text-[var(--color-oxblood,#C13438)]">
          {error}
        </p>
      )}

      {tickers.length === 0 ? (
        <EmptyState
          title="no tickers yet"
          body="add your first ticker to start seeing prices in your terminal"
          action={addForm}
        />
      ) : (
        <>
          <SortableList
            items={tickers}
            onReorder={onReorder}
            renderItem={(item, dragHandle) => {
              const spark = sparkMap.get(item.symbol)
              // compute day pct from sparkline first/last if available
              const pts = spark?.points ?? []
              let dayPct: number | null = null
              if (pts.length >= 2) {
                const first = pts[0]?.price ?? 0
                const last = pts[pts.length - 1]?.price ?? 0
                dayPct = first !== 0 ? ((last - first) / first) * 100 : null
              }

              return (
                <div className="flex items-center gap-3 py-2.5 px-1">
                  {/* drag handle */}
                  <div className="shrink-0">{dragHandle}</div>

                  {/* symbol */}
                  <span className="w-[72px] shrink-0 font-[var(--font-data)] text-[12px] font-bold tracking-[0.04em] text-[var(--ink-primary)]">
                    {item.symbol}
                  </span>

                  {/* asset class badge */}
                  <span className="w-[40px] shrink-0 font-[var(--font-data)] text-[10px] text-[var(--ink-faint,var(--ink-tertiary))]">
                    {item.assetClass}
                  </span>

                  {/* sparkline */}
                  <div className="shrink-0">
                    <Sparkline points={pts} />
                  </div>

                  {/* day pct */}
                  <span
                    className="w-[52px] shrink-0 font-[var(--font-data)] text-[11px] tabular-nums text-right"
                    style={{ color: dayPct !== null ? pctColor(dayPct) : "var(--ink-tertiary)" }}
                  >
                    {dayPct !== null ? `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}%` : "—"}
                  </span>

                  {/* spacer */}
                  <div className="flex-1" />

                  {/* remove */}
                  <button
                    type="button"
                    onClick={() => removeTicker(item.symbol)}
                    disabled={pending}
                    className="opacity-0 group-hover:opacity-100 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] border border-[var(--rule-default)] px-2 py-0.5 hover:border-[var(--color-oxblood,#C13438)] hover:text-[var(--color-oxblood,#C13438)] transition-all disabled:opacity-30"
                  >
                    remove
                  </button>
                </div>
              )
            }}
          />

          <SectionRule />
          {addForm}
        </>
      )}
    </div>
  )
}
